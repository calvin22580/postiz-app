export const dynamic = 'force-dynamic';
// OURS: the plan and usage screen. New route, see apps/frontend/src/ours/plans.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { PlanPage } from '@gitroom/frontend/ours/plans/plan.page';

export const metadata: Metadata = {
  title: `${brand.name} Plan and usage`,
  description: '',
};

export default function Page() {
  return <PlanPage />;
}
