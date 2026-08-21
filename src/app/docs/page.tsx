import Link from "next/link";

export const metadata = { title: "Apparatus criticus" };

const rows = [
  ["request_review(id, governor, proposal_id, block)", "anyone", "payable; creates the bonded record"],
  ["review(id) · rereview(id)", "anyone", "permissionless consensus write"],
  ["rebut(id, review_id, argument_url)", "anyone", "payable; bond exactly matches the review"],
  ["adjudicate_rebuttal(id) · expire_rebuttal_window(id)", "anyone", "permissionless write"],
  ["clear_veto_by_vote(id, vote_ref)", "anyone", "records a governance override"],
  ["is_vetoed(governor, proposal_id)", "integrators", "free structured read"],
];

export default function DocsPage() {
  return <div className="flex max-w-[100ch] flex-col gap-12">
    <header className="flex flex-col gap-4"><p className="ig-label">apparatus criticus</p><h1 className="ig-display">How Intent Guard reaches, and refuses, a finding.</h1><p className="ig-body max-w-[72ch]">This is a narrow execution-integrity check. It asks whether a specific proposal&apos;s executable calls stay within the authority its published mandate describes. It is not a policy evaluator, an auditor of target contracts, or a replacement for token-holder governance.</p></header>
    <Section title="The order of operations"><ol className="ig-body grid gap-3 border-y border-[var(--rule)] py-4"><li>1. Recover the Governor&apos;s ProposalCreated log using the supplied block hint; reject an id mismatch.</li><li>2. Fetch the Governor action set from independent sources and canonicalise both results.</li><li>3. Refuse as UNDECODABLE if those sources disagree, a selector cannot be verified, or nesting crosses the stated limit.</li><li>4. Decode actions and verify selector names by recomputing keccak256(signature)[:4].</li><li>5. Only then ask whether the mandate authorises the decoded actions. The result is deterministically re-checked before it is stored.</li></ol></Section>
    <Section title="Verdicts"><Table head={["State", "Meaning", "Veto"]} rows={[["ALIGNED", "Decoded actions are within the mandate.", "no"], ["DIVERGENT", "A named decoded action exceeds the mandate.", "yes, advisory"], ["UNDERSPECIFIED", "The mandate cannot authorise or exclude the action set.", "no"], ["UNDECODABLE", "A gate failed before judgment.", "no; bond returned"]]} /></Section>
    <Section title="Public calls"><Table head={["Call", "Who may call", "What it does"]} rows={rows} /></Section>
    <Section title="Integration surface"><p className="ig-body">A timelock guard should call <code className="ig-calldata">is_vetoed(governor, proposal_id)</code>. The response includes both <code className="ig-calldata">vetoed</code> and <code className="ig-calldata">reviewed</code>; an unreviewed proposal is not the same as an aligned one. This app exposes the same semantics rather than deriving a boolean from ledger rows.</p></Section>
    <Section title="What it cannot establish"><ul className="ig-body list-disc space-y-2 pl-5"><li>Whether the mandate is good policy, whether recipients are trustworthy, or whether an action is economically wise.</li><li>What an opaque or over-depth payload does. It refuses instead of inventing a selector name.</li><li>Whether a DAO should honour a veto. A new governance vote may clear one, and the recorded reference remains public.</li><li>Anything about unsupported Governor implementations; they are refused at intake.</li></ul><p className="ig-aside mt-4">Read a concrete review in the <Link className="underline decoration-1 underline-offset-4" href="/reviews">ledger</Link>, or begin with a bonded <Link className="underline decoration-1 underline-offset-4" href="/reviews/new">review request</Link>.</p></Section>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="flex flex-col gap-4"><h2 className="ig-heading">{title}</h2>{children}</section>; }
function Table({ head, rows }: { head: string[]; rows: string[][] }) { return <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr>{head.map((cell) => <th className="ig-label border-y border-[var(--rule-strong)] py-3 pr-5" key={cell}>{cell}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, i) => <td className={`ig-aside border-b border-[var(--rule)] py-3 pr-5 align-top ${i === 0 ? "ig-calldata whitespace-nowrap" : ""}`} key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>; }
