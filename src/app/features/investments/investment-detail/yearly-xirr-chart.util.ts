import { barPath } from '../../../utils/cash-flow-report.util';
import { niceTicks } from '../../../utils/cash-flow-chart.util';

export interface YearlyXirr { year: number; value: number | null; profit: number | null; }

export interface YearlyBar {
  year: number;
  value: number | null;
  profit: number | null;
  /** מרכז העמודה בציר X */
  cx: number;
  /** נתיב העמודה; ריק כשאין ערך או שהערך 0 */
  d: string;
  /** מיקום Y של תווית הערך (מעל עמודה חיובית, מתחת לשלילית) */
  labelY: number;
  positive: boolean;
}

export interface YearlyChart {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  zeroY: number;
  barWidth: number;
  ticks: { y: number; label: string }[];
  bars: YearlyBar[];
}

const WIDTH = 600;
const HEIGHT = 240;
const MARGIN = { top: 24, right: 12, bottom: 30, left: 44 };
const BAR_MAX = 44;

/**
 * גרף עמודות של XIRR לפי שנה: סקאלה "עגולה" שכוללת תמיד את 0, קווי רשת,
 * עמודות ממורכזות ברצועה של כל שנה ברוחב מקסימלי קבוע.
 */
export function buildYearlyXirrChart(years: YearlyXirr[]): YearlyChart {
  const values = years.map(y => y.value).filter((v): v is number => v !== null);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const tickValues = niceTicks(min, max === min ? min + 1 : max, 4);
  const lo = tickValues[0];
  const hi = tickValues[tickValues.length - 1];

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const y = (v: number) => MARGIN.top + (hi - v) / (hi - lo || 1) * plotH;
  const zeroY = y(0);

  const band = plotW / Math.max(1, years.length);
  const barWidth = Math.min(BAR_MAX, band * 0.6);

  const bars = years.map((yr, i) => {
    const cx = MARGIN.left + band * i + band / 2;
    const positive = (yr.value ?? 0) >= 0;
    const yEnd = yr.value === null ? zeroY : y(yr.value);
    return {
      ...yr,
      cx,
      d: barPath(cx - barWidth / 2, yEnd, zeroY, barWidth, 4),
      labelY: positive ? yEnd - 6 : yEnd + 14,
      positive,
    };
  });

  return {
    width: WIDTH,
    height: HEIGHT,
    margin: MARGIN,
    zeroY,
    barWidth,
    ticks: tickValues.map(v => ({ y: y(v), label: `${Number(v.toFixed(1))}%` })),
    bars,
  };
}
