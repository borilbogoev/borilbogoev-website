// The B* monogram, outlined from Inter Display ExtraBold (design system, Logos). Ink B, red asterisk.
export function Monogram({ height = 30, inverse = false }: { height?: number; inverse?: boolean }) {
  const width = (2282 / 1654) * height;
  return (
    <svg width={width} height={height} viewBox="14 -1572 2282 1654" role="img" aria-label="Boril Bogoev" focusable="false">
      <path
        fill={inverse ? "#FFFFFF" : "#1A1A1A"}
        d="M96 0H761C1092 0 1279 -174 1279 -421C1279 -632 1136 -768 950 -780V-782C1118 -819 1227 -940 1227 -1112C1227 -1335 1047 -1490 716 -1490H96ZM447 -276V-623H704C833 -623 912 -555 912 -447C912 -340 832 -276 702 -276ZM447 -885V-1214H682C797 -1214 868 -1150 868 -1050C868 -949 797 -885 682 -885Z"
      />
      <path
        fill="#C72C2C"
        d="M1693.6 -652H1903.6L1883.6 -923L2109.6 -770L2214.6 -952L1970.6 -1070L2214.6 -1188L2109.6 -1372L1883.6 -1219L1903.6 -1490H1693.6L1714.6 -1219L1488.6 -1372L1382.6 -1188L1628.6 -1070L1382.6 -952L1488.6 -770L1714.6 -923Z"
      />
    </svg>
  );
}
