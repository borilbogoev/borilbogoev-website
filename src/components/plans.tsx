"use client";

import { useState } from "react";
import type { Plan, PlanRow } from "@/content/types";
import { CheckIcon, MinusIcon } from "./icons";

function Cell({ value }: { value: boolean | string }) {
  if (value === true)
    return (
      <span className="inline-flex text-brand" role="img" aria-label="Included">
        <CheckIcon size={20} />
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex text-muted/60" role="img" aria-label="Not included">
        <MinusIcon size={18} />
      </span>
    );
  return <span className="text-[14px] font-semibold">{value}</span>;
}

/** A previous price, crossed out, as a caption under the current one. */
function OldPrice({ value, className = "" }: { value: string; className?: string }) {
  return (
    <p className={`t-caption text-muted ${className}`}>
      <span className="sr-only-bb">Was </span>
      <del>{value}</del>
    </p>
  );
}

/**
 * Comparison table. On desktop every plan is a column. On a phone one plan shows at a time,
 * picked with a segmented control, so the table stays two columns wide and never scrolls sideways.
 */
export function PlanTable({ plans, rows, label }: { plans: Plan[]; rows: PlanRow[]; label: string }) {
  const [active, setActive] = useState(0);
  const current = plans[active];

  return (
    <div>
      <div role="tablist" aria-label={label} className="mb-4 flex gap-1 rounded-full bg-surface-alt p-1 md:hidden" style={{ border: "1px solid var(--line)" }}>
        {plans.map((plan, i) => (
          <button
            key={plan.id}
            type="button"
            role="tab"
            id={`plan-tab-${plan.id}`}
            aria-selected={i === active}
            aria-controls="plan-table"
            onClick={() => setActive(i)}
            className={`min-h-[44px] flex-1 rounded-full px-3 text-[14px] font-semibold transition-colors ${i === active ? "bg-ink text-surface" : "text-muted"}`}
          >
            {plan.name}
          </button>
        ))}
      </div>

      <div className="mb-4 rounded-[14px] border border-line bg-surface-alt p-5 md:hidden" aria-live="polite">
        <p className="label text-muted">{current.sub ?? "Price"}</p>
        <p className="t-stat mt-2">{current.price}</p>
        {current.oldPrice && <OldPrice value={current.oldPrice} className="mt-1" />}
        {current.priceNote && <p className="t-caption mt-1 text-muted">{current.priceNote}</p>}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-line bg-surface" style={{ boxShadow: "var(--shadow)" }}>
        <table id="plan-table" className="plan-table w-full border-collapse text-left" data-active={active}>
          <thead>
            <tr>
              <th scope="col" className="sr-only-bb md:not-sr-only md:w-[40%] md:p-5 md:align-bottom">
                <span className="label text-muted">Feature</span>
              </th>
              {plans.map((plan, i) => (
                <th key={plan.id} scope="col" data-col={i} className="p-5 text-center align-bottom">
                  <span className="t-h3 block">{plan.name}</span>
                  {plan.sub && <span className="label mt-1 block text-muted">{plan.sub}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature} className="border-t border-line">
                <th scope="row" className="py-3.5 pl-4 pr-3 text-[14px] font-medium leading-[1.5] md:px-5">
                  {row.feature}
                </th>
                {row.values.map((value, i) => (
                  <td key={i} data-col={i} className="px-4 py-3.5 text-center align-middle md:px-5">
                    <Cell value={value} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="hidden md:table-footer-group">
            <tr className="border-t border-line bg-surface-alt">
              <th scope="row" className="p-5 text-[14px] font-semibold">
                Price
              </th>
              {plans.map((plan, i) => (
                <td key={plan.id} data-col={i} className="p-5 text-center">
                  <span className="block text-[22px] font-extrabold leading-tight tracking-tight">{plan.price}</span>
                  {plan.oldPrice && <OldPrice value={plan.oldPrice} />}
                  {plan.priceNote && <span className="t-caption block text-muted">{plan.priceNote}</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Price cards, for offers whose plans share the same work and differ only in price. */
export function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
      {plans.map((plan) => (
        <li key={plan.id} className="card card-raised text-center">
          <p className="t-h3">{plan.name}</p>
          {plan.sub && <p className="label mt-1 text-muted">{plan.sub}</p>}
          <p className="t-stat mt-5">{plan.price}</p>
          {plan.oldPrice && <OldPrice value={plan.oldPrice} className="mt-2" />}
          {plan.priceNote && <p className="t-caption mt-2 text-muted">{plan.priceNote}</p>}
        </li>
      ))}
    </ul>
  );
}
