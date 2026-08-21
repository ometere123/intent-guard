import Link from "next/link";
import { ledgerCounts } from "@/lib/genlayer/data-source";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const counts = await ledgerCounts();
  const liveCounts = counts.kind === "AVAILABLE" ? counts.value : null;

  return (
    <div className="flex flex-col gap-14">
      <header className="grid gap-8 spread:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] spread:gap-[var(--gutter)]">
        <div className="flex flex-col gap-5">
          <p className="ig-label">an apparatus for governance execution</p>
          <h1 className="ig-display max-w-[21ch] text-[42px] leading-[46px] spread:text-[72px] spread:leading-[74px]">
            Do these bytes do what that text said?
          </h1>
          <p className="ig-body max-w-[58ch]">
            Intent Guard reads a proposal&apos;s published mandate beside the actions its Governor
            will execute. It raises a public, reviewable objection when the decoded calldata
            exceeds that mandate. It does not govern a DAO and it does not block execution alone.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/reviews/new" className="ig-btn">
              request a review
            </Link>
            <Link href="/reviews" className="ig-btn-quiet">
              inspect the ledger
            </Link>
          </div>
        </div>
        <aside className="ig-recto border-y border-[var(--rule-strong)] px-5 py-5">
          <p className="ig-label">the constitutional limit</p>
          <p className="ig-heading mt-3">
            Intent Guard raises objections. Token holders retain the last word.
          </p>
          <p className="ig-aside mt-3">
            A divergent review sets a flag that a timelock guard may honour. A fresh governance
            vote, recorded on-chain, clears it. An undecodable proposal is refused, never guessed at.
          </p>
        </aside>
      </header>

      <section className="grid gap-8 spread:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] spread:gap-[var(--gutter)]">
        <div className="border-t border-[var(--rule-strong)] pt-4">
          <p className="ig-label">the left-hand page · mandate</p>
          <p className="ig-body mt-3 max-w-[52ch]">
            Validators locate the Governor&apos;s ProposalCreated log and recover the published
            description. It is a claim of authority, not a friendly summary supplied by the person
            requesting review.
          </p>
        </div>
        <div className="ig-recto border-t border-[var(--rule-strong)] px-5 pt-4">
          <p className="ig-label">the right-hand page · calldata</p>
          <p className="ig-body mt-3 max-w-[52ch]">
            Validators independently fetch the executable action set, corroborate it, ABI-decode
            it, and verify selector names with keccak before any semantic judgment is asked.
          </p>
        </div>
      </section>

      <section className="border-y border-[var(--rule)] py-5">
        <p className="ig-label">ledger summary</p>
        {!liveCounts ? (
          <p className="ig-body mt-3">Live records could not be retrieved. This is not evidence that the ledger is empty.</p>
        ) : (
        <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 spread:grid-cols-6">
          <Count label="records" value={liveCounts.total} />
          <Count label="aligned" value={liveCounts.aligned} />
          <Count label="divergent" value={liveCounts.divergent} rubric />
          <Count label="underspecified" value={liveCounts.underspecified} />
          <Count label="undecodable" value={liveCounts.undecodable} />
          <Count label="vetoes standing" value={liveCounts.standingVetoes} rubric />
        </dl>
        )}
      </section>

      <section className="grid gap-8 spread:grid-cols-3">
        <Step n="01" title="Request" text="Name a supported Governor proposal and post a bond. The request does no network work." />
        <Step n="02" title="Review" text="Anyone may run the permissionless consensus round. Deterministic gates finish before inference begins." />
        <Step n="03" title="Answer" text="A proposer can bond a rebuttal. An upheld objection stands; a successful rebuttal or new vote clears it." />
      </section>
    </div>
  );
}

function Count({ label, value, rubric }: { label: string; value: number; rubric?: boolean }) {
  return <div><dt className="ig-label">{label}</dt><dd className={`ig-display mt-1 ${rubric && value ? "ig-rubric" : ""}`}>{value}</dd></div>;
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return <article className="border-t border-[var(--rule-strong)] pt-3"><p className="ig-calldata-sm opacity-60">{n}</p><h2 className="ig-heading mt-2">{title}</h2><p className="ig-aside mt-2">{text}</p></article>;
}
