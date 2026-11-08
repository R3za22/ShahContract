import type { Address } from "../types";

/** Fixed fake addresses for the simulated chain. They are not real accounts on any network. */
export const ADDR = {
  you: "0x3f9Abb0347a468d97e98a9c00e37cebec1abb21C",
  farzaneh: "0x7aD3c4f6ac64fb08da1f43d94f479bea2d17c11F",
  kaveh: "0xE2100dd105606782d7c7035ee7c5eee4ef159b4A",
  bahar: "0x1c7F344f5257873f94e8f6113787f24022ead0e3",
  storybot: "0x51B2442833d3a082c63cf819aa1e183fe7b40aE9",
  newowner: "0xC4d847273da4472cbddf62462a129a9499a67e02",
  reader: "0x9d443d0941964aa3ebdcb00ccef58b1bb399aa10",
  wallet: "0x8Be0e8d44050873dba865aa7c170ab4cce6441aD",
  story: "0x6B21c478361e6869af25970682a2c53967ad07Fe",
  stranger: "0xA09c8aca4f36774f82a67c507cb9c966794855D1",
} as const;

export interface Named { en: string; fa: string }
export const MOCK_NAMES: Record<Address, Named> = {
  [ADDR.you]: { en: "You", fa: "شما" },
  [ADDR.farzaneh]: { en: "Farzaneh", fa: "فرزانه" },
  [ADDR.kaveh]: { en: "Kaveh", fa: "کاوه" },
  [ADDR.bahar]: { en: "Bahar", fa: "بهار" },
  [ADDR.storybot]: { en: "Story Bot", fa: "ربات داستان" },
  [ADDR.newowner]: { en: "New device", fa: "دستگاه تازه" },
  [ADDR.reader]: { en: "A reader", fa: "یک خواننده" },
  [ADDR.wallet]: { en: "Your wallet", fa: "کیف پول شما" },
  [ADDR.story]: { en: "Story contract", fa: "قرارداد داستان" },
  [ADDR.stranger]: { en: "Stranger", fa: "ناشناس" },
};
/** Accounts the simulated wallet can act as. */
export const MOCK_ACTORS: Address[] = [ADDR.you, ADDR.farzaneh, ADDR.kaveh, ADDR.bahar, ADDR.storybot, ADDR.newowner, ADDR.reader];
