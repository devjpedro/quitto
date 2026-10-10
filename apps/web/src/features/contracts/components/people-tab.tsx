import { inviteCardOf } from "../lib/people-view";
import type { ContractDetail } from "../types";
import { InviteCard } from "./invite-card";
import { PersonRow } from "./person-row";

/**
 * The Pessoas tab (mockup 14, F1): one filled block with a line per person;
 * for the owner, the other party known only by name gets the dashed invite
 * under it. No explanatory notes: the tags say it.
 */
export function PeopleTab({ detail }: { detail: ContractDetail }) {
  const contractId = detail.contract.id;
  const invite = inviteCardOf(detail);
  return (
    <div>
      <ul
        className="divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
        data-testid="people-list"
      >
        {detail.participants.map((person) => (
          <PersonRow
            contractId={contractId}
            key={person.id}
            person={person}
            viewerIsOwner={detail.isOwner}
          />
        ))}
      </ul>
      {invite ? (
        <InviteCard
          contractId={contractId}
          participant={invite.participant}
          pays={invite.pays}
        />
      ) : null}
    </div>
  );
}
