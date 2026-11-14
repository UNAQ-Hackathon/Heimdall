"""Lectura de observaciones climáticas desde archivos CSV."""

from pathlib import Path

import numpy as np
import pandas as pd


FREQUENCIES = {"hourly": "h", "daily": "D", "monthly": "M", "annual": "Y"}
LCD_TEMPERATURE = "HourlyDryBulbTemperatureC"
LCD_MIN_HOURS = 18


def _select_station(
    frame: pd.DataFrame, station: str | None, fallback: str
) -> tuple[pd.DataFrame, str]:
    if "STATION" not in frame:
        if station is not None:
            raise ValueError("El CSV necesita una columna STATION para elegir una estación.")
        return frame, fallback

    identifiers = frame["STATION"].str.strip()
    available = sorted(identifiers[identifiers.ne("")].unique())
    if not available:
        raise ValueError("La columna STATION no contiene identificadores de estación.")
    if station is None:
        if len(available) > 1:
            raise ValueError(
                f"Elige una estación con --station. Disponibles: {', '.join(available)}."
            )
        station = available[0]
    elif station not in available:
        raise ValueError(
            f"No se encontró la estación {station!r}. Disponibles: {', '.join(available)}."
        )

    selected = frame.loc[identifiers.eq(station)]
    for name_column in ("STATION_NAME", "NAME"):
        if name_column in selected:
            names = selected[name_column].str.strip()
            names = names[names.ne("")].unique()
            if len(names) == 1:
                return selected, f"{names[0]} ({station})"
    return selected, station


def _finite_values(column: pd.Series) -> pd.Series:
    values = pd.to_numeric(column, errors="coerce").astype(float)
    return values.where(np.isfinite(values))


def _load_generic(
    frame: pd.DataFrame, frequency: str, date_column: str, value_column: str
) -> pd.Series:
    missing = [column for column in (date_column, value_column) if column not in frame]
    if missing:
        raise ValueError(f"Faltan columnas en el CSV: {', '.join(missing)}.")

    date_text = frame[date_column].str.strip()
    compact_month = date_text.str.fullmatch(r"\d{6}")
    date_text.loc[compact_month] = (
        date_text.loc[compact_month].str[:4] + "-" + date_text.loc[compact_month].str[4:]
    )
    has_year = date_text.str.contains(r"(?<!\d)\d{4}(?!\d)|^\d{8}(?:[ T]|$)")
    dates = pd.to_datetime(date_text.where(has_year), format="mixed", errors="coerce", utc=True)
    values = _finite_values(frame[value_column])
    invalid_dates = dates.isna() & (date_text.ne("") | values.notna())
    if invalid_dates.any():
        example = frame.loc[invalid_dates, date_column].iloc[0]
        raise ValueError(
            f"Fecha inválida en {date_column!r}: {example!r}. Usa fechas ISO o años de cuatro cifras."
        )

    dated = dates.notna()
    periods = dates.loc[dated].dt.tz_localize(None).dt.to_period(frequency)
    if periods.duplicated().any():
        duplicate = periods.loc[periods.duplicated()].iloc[0]
        raise ValueError(
            f"Hay más de una fila para el periodo {duplicate}. Usa una observación por periodo."
        )

    return pd.Series(values.loc[dated].to_numpy(), index=pd.PeriodIndex(periods), name=value_column)


def _load_lcd(frame: pd.DataFrame, frequency: str) -> pd.Series:
    required = {"DATE", "reportType", LCD_TEMPERATURE}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Faltan columnas para el formato LCD: {', '.join(sorted(missing))}.")

    observations = frame.loc[frame["reportType"].str.strip().eq("FM-15")]
    times = pd.to_datetime(observations["DATE"], format="%Y-%m-%d %H:%M", errors="coerce")
    if times.isna().any():
        raise ValueError("El CSV LCD contiene fechas inválidas en registros FM-15.")

    temperatures = _finite_values(observations[LCD_TEMPERATURE])
    hours = temperatures.groupby(times.dt.to_period("h")).mean().dropna().rename(LCD_TEMPERATURE)
    if frequency == "h":
        return hours
    daily = hours.groupby(hours.index.asfreq("D"))
    return daily.mean().where(daily.count().ge(LCD_MIN_HOURS)).rename(LCD_TEMPERATURE)


def load_series(
    path: Path,
    *,
    frequency: str,
    date_column: str,
    value_column: str,
    station: str | None,
    lcd: bool,
) -> tuple[pd.Series, str]:
    """Devuelve observaciones válidas por periodo y la etiqueta de su origen."""
    if frequency not in FREQUENCIES:
        raise ValueError(f"Frecuencia inválida: {frequency!r}. Usa hourly, daily, monthly o annual.")
    if lcd and frequency not in ("hourly", "daily"):
        raise ValueError("El formato LCD admite las frecuencias hourly y daily.")
    try:
        frame = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except pd.errors.EmptyDataError as error:
        raise ValueError(f"El CSV {path.name!r} está vacío.") from error
    except (OSError, UnicodeError, pd.errors.ParserError) as error:
        raise ValueError(f"No se pudo leer el CSV {path.name!r}: {error}") from error

    frame, label = _select_station(frame, station, path.stem)
    if lcd:
        series = _load_lcd(frame, FREQUENCIES[frequency])
    else:
        series = _load_generic(frame, FREQUENCIES[frequency], date_column, value_column)
    series = series.dropna().sort_index()
    if series.empty:
        if lcd and frequency == "daily":
            raise ValueError(
                f"El CSV LCD no tiene días con al menos {LCD_MIN_HOURS} horas de temperatura válidas."
            )
        if lcd:
            raise ValueError("El CSV LCD no tiene horas con temperatura válida en registros FM-15.")
        raise ValueError(f"No hay observaciones numéricas válidas en {value_column!r}.")
    return series, label
