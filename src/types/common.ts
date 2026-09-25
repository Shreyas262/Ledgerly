export type EntityId = string;
export type ID = EntityId;
export type ISODateString = string;
export type CurrencyCode = "INR";

export interface ResourceTimestamps {
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type ResourceScope = "OWN" | "TEAM" | "ORGANIZATION";
