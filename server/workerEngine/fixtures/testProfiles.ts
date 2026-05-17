/**
 * server/workerEngine/fixtures/testProfiles.ts
 *
 * Synthetic test profiles — 100% fictional data.
 * These profiles are used only for safe test mode in the CS Worker Engine tests.
 * DO NOT use any data from user_attachment/ files or real Adverse Action Notice files.
 */

export interface TestProfile {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  dob: string; // YYYY-MM-DD
  annualIncome: number;
  expectedScoreRange: [number, number]; // [min, max]
}

/**
 * 5 synthetic test profiles — all data is completely fictional.
 *
 * Score ranges are estimated bands based on income and credit profile factors
 * used only for test assertions; the actual scoring is done by buildOneCsResult.
 */
export const TEST_PROFILES: TestProfile[] = [
  {
    firstName: "John",
    lastName: "Anderson",
    street: "742 Evergreen Terrace",
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
    dob: "1985-03-15",
    annualIncome: 78_000,
    expectedScoreRange: [700, 780],
  },
  {
    firstName: "Sarah",
    lastName: "Mitchell",
    street: "1200 Barton Creek Blvd",
    city: "Austin",
    state: "TX",
    zipCode: "78735",
    dob: "1990-07-22",
    annualIncome: 95_000,
    expectedScoreRange: [730, 800],
  },
  {
    firstName: "Robert",
    lastName: "Chen",
    street: "3400 Pike Street",
    city: "Seattle",
    state: "WA",
    zipCode: "98101",
    dob: "1978-11-08",
    annualIncome: 120_000,
    expectedScoreRange: [740, 810],
  },
  {
    firstName: "Emily",
    lastName: "Watson",
    street: "8800 East Colfax Ave",
    city: "Denver",
    state: "CO",
    zipCode: "80220",
    dob: "1993-05-30",
    annualIncome: 52_000,
    expectedScoreRange: [620, 700],
  },
  {
    firstName: "Michael",
    lastName: "Park",
    street: "5550 Biscayne Boulevard",
    city: "Miami",
    state: "FL",
    zipCode: "33137",
    dob: "1982-09-12",
    annualIncome: 65_000,
    expectedScoreRange: [660, 740],
  },
];

/**
 * Returns a profile by index. Throws if index is out of bounds.
 */
export function getTestProfile(index: number): TestProfile {
  if (index < 0 || index >= TEST_PROFILES.length) {
    throw new RangeError(`Test profile index ${index} out of bounds (max ${TEST_PROFILES.length - 1})`);
  }
  return TEST_PROFILES[index];
}

/**
 * Returns all test profiles, optionally filtered by state.
 */
export function getTestProfilesByState(state: string): TestProfile[] {
  return TEST_PROFILES.filter(p => p.state.toUpperCase() === state.toUpperCase());
}