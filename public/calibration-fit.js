import {calibrationLimits} from './calibration.js';

const referenceHz = 130.81278265;

// Fit the same log-frequency transfer used by calibratedFrequency. Keep the
// source measurements so the result can be reproduced rather than certified.
export function fitTracking(evidence, unit) {
  const unique = new Map();
  for (const item of evidence || []) {
    if (item.unit !== unit || !/^[a-f0-9]{64}$/.test(item.sha256) || !item.settings?.trim() || !item.method?.startsWith('Isolated oscillator')) continue;
    if (!Number.isFinite(item.nominalHz) || !Number.isFinite(item.measuredHz) || item.nominalHz < 30 || item.nominalHz > 5000 || item.measuredHz <= 0) continue;
    unique.set(item.sha256, item);
  }
  const points = [...unique.values()];
  if (points.length < 3 || new Set(points.map(p => p.nominalHz)).size < 3) throw new Error('Measure at least three different pitches in separate recordings.');
  const nominal = points.map(p => p.nominalHz), span = 12 * Math.log2(Math.max(...nominal) / Math.min(...nominal));
  if (span < 12 - 1e-6) throw new Error('Use pitches spanning at least one octave.');
  const xs = points.map(p => Math.log2(p.nominalHz / referenceHz)), ys = points.map(p => Math.log2(p.measuredHz / referenceHz));
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length, mx = mean(xs), my = mean(ys);
  const variance = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const tracking = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / variance;
  const cents = (my - tracking * mx) * 1200;
  if (!Number.isFinite(cents) || !Number.isFinite(tracking) || cents < calibrationLimits.cents[0] || cents > calibrationLimits.cents[1] || tracking < calibrationLimits.tracking[0] || tracking > calibrationLimits.tracking[1]) throw new Error('The measured tuning is outside the calibration range. Check nominal pitches and instrument settings.');
  const errors = xs.map((x, i) => 1200 * (ys[i] - tracking * x) - cents);
  const rmsCents = Math.sqrt(mean(errors.map(error => error ** 2))), maximumCents = Math.max(...errors.map(Math.abs));
  if (rmsCents > 10 || maximumCents > 20) throw new Error('Measurements disagree with a single tuning/tracking fit. Remove the mismatched recording or measure again after warm-up.');
  return {cents, tracking, rmsCents, maximumCents, spanSemitones:span, recordings:points.length};
}

export function offsetAtPitch(measuredCents, nominalHz, tracking) {
  return measuredCents - (tracking - 1) * 1200 * Math.log2(nominalHz / referenceHz);
}
