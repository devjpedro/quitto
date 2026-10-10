export interface PeopleSearch {
  person?: string;
}

const KEY = /^[0-9a-f]{16}$/;

/** Pessoas' search: the person open in the sheet (an opaque 16-hex key). Anything else is dropped. */
export function peopleSearch(search: Record<string, unknown>): PeopleSearch {
  return {
    person:
      typeof search.person === "string" && KEY.test(search.person)
        ? search.person
        : undefined,
  };
}
