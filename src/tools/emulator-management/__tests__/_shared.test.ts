import { describe, it, expect } from 'vitest';
import { parseAvdManagerListOutput } from '../_shared.js';

const SAMPLE_OUTPUT = `Available Android Virtual Devices:
    Name: Pixel_8_API_34
  Device: pixel_8 (Google)
    Path: /home/user/.android/avd/Pixel_8_API_34.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 14.0 (UpsideDownCake) Tag/ABI: google_apis/arm64-v8a
    Skin: pixel_8
  Sdcard: 512M
---------
    Name: Pixel_7_API_33
  Device: pixel_7 (Google)
    Path: /home/user/.android/avd/Pixel_7_API_33.avd
  Target: Google APIs (Google Inc.)
          Based on: Android 13.0 (TiramisuPrivacySandbox) Tag/ABI: google_apis/x86_64
    Skin: pixel_7
`;

describe('parseAvdManagerListOutput', () => {
  it('parses every AVD block', () => {
    const avds = parseAvdManagerListOutput(SAMPLE_OUTPUT);
    expect(avds).toHaveLength(2);
    expect(avds[0]?.name).toBe('Pixel_8_API_34');
    expect(avds[0]?.tagAbi).toBe('google_apis/arm64-v8a');
    expect(avds[1]?.name).toBe('Pixel_7_API_33');
    expect(avds[1]?.tagAbi).toBe('google_apis/x86_64');
  });

  it('returns an empty array for output with no AVDs', () => {
    expect(parseAvdManagerListOutput('Available Android Virtual Devices:\n')).toEqual([]);
  });
});
