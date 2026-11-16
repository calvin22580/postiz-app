'use client';
// OURS: a message from the backend, with "Plan and usage" turned into a link
// to the plan screen (Milestone 7). Plan limit messages name the screen.
import { FC, Fragment } from 'react';
import Link from 'next/link';

const SCREEN = 'Plan and usage';

export const PlanMessage: FC<{ text: string }> = ({ text }) => {
  const parts = text.split(SCREEN);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <Link href="/plan" className="underline" data-testid="plan-link">
              {SCREEN}
            </Link>
          )}
        </Fragment>
      ))}
    </>
  );
};
