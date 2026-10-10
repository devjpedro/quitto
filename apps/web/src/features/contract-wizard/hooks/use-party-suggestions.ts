import { useQuery } from "@tanstack/react-query";
import { peopleQueryOptions } from "@/features/people/api";
import type { Person } from "@/features/people/types";
import { partySuggestions } from "../lib/party-suggestions";

const NONE: Person[] = [];

/**
 * The suggestions for what is typed. Never suspends the step: while the list
 * loads, or if it fails, there are none (the step works without them).
 */
export function usePartySuggestions(typed: string): Person[] {
  const { data } = useQuery({ ...peopleQueryOptions, throwOnError: false });
  return data ? partySuggestions(data.people, typed) : NONE;
}
