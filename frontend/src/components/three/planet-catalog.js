export const PLANET_MODELS = Object.freeze(
  [
    {
      id: 'mercury',
      label: 'Mercury',
      filename: 'Mercurio.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 0.38,
      distanceFromSun: '0.39 AU (57.9M km)',
      publicDescription: 'Innermost rocky planet with extreme surface temperature swings and an ultrathin exosphere.',
    },
    {
      id: 'venus',
      label: 'Venus',
      filename: 'Venus.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 0.904,
      distanceFromSun: '0.72 AU (108.2M km)',
      publicDescription: 'Terrestrial planet shrouded in a dense, superheated carbon dioxide atmosphere with sulfuric acid clouds.',
    },
    {
      id: 'earth',
      label: 'Earth',
      filename: 'Tierra.glb',
      analyzable: true,
      scenarioId: 'earth',
      subScenarios: ['earth', 'iss', 'suit'],
      gravityG: 1.0,
      distanceFromSun: '1.00 AU (149.6M km)',
      publicDescription: '1g terrestrial baseline for spacecraft fire safety standards (NASA-STD-6001) and ISS/LEO orbital operations.',
    },
    {
      id: 'moon',
      label: 'Moon',
      filename: 'Luna.glb',
      analyzable: true,
      scenarioId: 'moon',
      gravityG: 0.165,
      distanceFromSun: '1.00 AU (384,400 km from Earth)',
      publicDescription: 'Primary exploration target for crewed lunar surface habitats and pressurized rovers (≥30% O₂, ≤10.2 psi).',
    },
    {
      id: 'mars',
      label: 'Mars',
      filename: 'Marte.glb',
      analyzable: true,
      scenarioId: 'mars',
      gravityG: 0.38,
      distanceFromSun: '1.52 AU (227.9M km)',
      publicDescription: 'Future crewed surface habitat destination; pressurized cabin atmosphere assumed same as lunar exploration standard.',
    },
    {
      id: 'jupiter',
      label: 'Jupiter',
      filename: 'Jupiter.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 2.53,
      distanceFromSun: '5.20 AU (778.5M km)',
      publicDescription: 'Largest gas giant in the Solar System, composed primarily of hydrogen and helium with banded ammonia cloud decks.',
    },
    {
      id: 'saturn',
      label: 'Saturn',
      filename: 'Saturno.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 1.065,
      distanceFromSun: '9.54 AU (1.43B km)',
      publicDescription: 'Gas giant characterized by an extensive icy ring system and deep hydrogen-helium atmospheric layers.',
    },
    {
      id: 'uranus',
      label: 'Uranus',
      filename: 'Urano.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 0.886,
      distanceFromSun: '19.19 AU (2.87B km)',
      publicDescription: 'Ice giant with an extreme axial tilt and a cold hydrogen, helium, and methane atmosphere.',
    },
    {
      id: 'neptune',
      label: 'Neptune',
      filename: 'Neptuno.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 1.14,
      distanceFromSun: '30.07 AU (4.50B km)',
      publicDescription: 'Outermost major ice giant featuring supersonic atmospheric winds and high-altitude methane ice clouds.',
    },
    {
      id: 'sun',
      label: 'Sun',
      filename: 'Sol.glb',
      analyzable: false,
      scenarioId: null,
      gravityG: 27.9,
      distanceFromSun: '0.00 AU (System Center)',
      publicDescription: 'G-type main-sequence star at the center of the Solar System.',
    },
  ].map(Object.freeze)
);

export const ISS_STATION_MODEL = Object.freeze({
  id: 'iss',
  label: 'ISS (LEO)',
  filename: 'issNuevo.glb',
  analyzable: true,
  scenarioId: 'iss',
  gravityG: 0,
  distanceFromSun: '1.00 AU (~408 km LEO)',
  publicDescription:
    'International Space Station in low Earth orbit (~0g), housing the CIR (ACME, FLEX/MDCA), MSG (BASS, SPICE, SLICE), and SAME fire safety experiments.',
});

export function getPlanetModel(id) {
  const model = PLANET_MODELS.find((entry) => entry.id === id);
  if (!model) throw new RangeError(`Unknown planetary model: ${id}`);
  return model;
}
