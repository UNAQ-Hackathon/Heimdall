import heimdallLogo from '../../../../docs/assets/heimdall-logo.png';

export default function HeimdallLogo({ size = 32 }) {
  return (
    <img
      src={heimdallLogo}
      alt="Heimdall"
      width={size}
      height={size}
      style={{ display: 'inline-block', objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
}
