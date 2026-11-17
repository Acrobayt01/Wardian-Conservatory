import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POND_CENTER,
  TERRARIUM_RADIUS,
  computeLightingState,
  computeWeatherState,
  formatClock,
  generateInitialFlora,
  isInsideBasin,
  isInsidePond,
  terrainHeightAt,
} from './environmentMath';

test('formatClock wraps 24-hour times cleanly', () => {
  assert.equal(formatClock(14.5), '14:30');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(24), '00:00');
  assert.equal(formatClock(26.25), '02:15');
});

test('computeLightingState transitions smoothly between day, golden hour, and night', () => {
  const noon = computeLightingState(12.5, 'clear');
  const golden = computeLightingState(18.0, 'clear');
  const midnight = computeLightingState(0.5, 'clear');

  assert.ok(noon.daylightFactor > 0.95, 'noon should have high daylightFactor');
  assert.equal(noon.bioluminescence, 0, 'mushrooms should not glow at noon');
  assert.equal(noon.phaseLabel, 'Daylight');

  assert.ok(
    golden.twilightFactor > 0.6,
    'golden hour should peak twilightFactor',
  );
  assert.equal(golden.phaseLabel, 'Golden Hour');

  assert.ok(
    midnight.nightFactor > 0.95,
    'midnight should have high nightFactor',
  );
  assert.ok(
    midnight.bioluminescence > 0.9,
    'bioluminescence should activate at night',
  );
  assert.ok(
    noon.keyIntensity > midnight.keyIntensity,
    'daylight sun intensity should exceed moonlight intensity',
  );
});

test('computeWeatherState responds to weather modes and humidity bias', () => {
  const clear = computeWeatherState('clear', 0);
  const rain = computeWeatherState('rain', 0);
  const mist = computeWeatherState('mist', 0);
  const humidClear = computeWeatherState('clear', 0.25);

  assert.equal(clear.rainRate, 0);
  assert.equal(rain.rainRate, 1);
  assert.ok(rain.condensation > clear.condensation);
  assert.ok(mist.mistDensity > rain.mistDensity);
  assert.ok(humidClear.humidityPct > clear.humidityPct);
});

test('terrainHeightAt produces elevated mound and sunken pond basin', () => {
  const moundH = terrainHeightAt(-0.68, -0.52);
  const pondH = terrainHeightAt(POND_CENTER.x, POND_CENTER.z);
  assert.ok(moundH > pondH + 0.35, 'bonsai mound should sit well above pond floor');
});

test('generateInitialFlora is deterministic and respects basin & pond bounds', () => {
  const a = generateInitialFlora(42);
  const b = generateInitialFlora(42);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 10, 'should populate a rich assortment of flora');

  const hero = a.find((f) => f.kind === 'bonsai');
  assert.ok(hero, 'should include hero bonsai');

  for (const item of a) {
    assert.ok(
      isInsideBasin(item.x, item.z, 0.25),
      `${item.id} must stay inside basin radius (${TERRARIUM_RADIUS})`,
    );
    assert.equal(
      isInsidePond(item.x, item.z, 0.05),
      false,
      `${item.id} must not spawn inside pond`,
    );
  }
});
