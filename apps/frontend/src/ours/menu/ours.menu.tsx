// OURS: our entries in the left menu. Spread into upstream's menu with one
// logged line in components/layout/top.menu.tsx.
export const oursFirstMenu = (
  t: (key: string, fallback: string) => string
) => [
  {
    name: t('ours_business_profile', 'Business profile'),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: '/business-profile',
  },
  {
    name: t('ours_weekly_posts', 'Weekly posts'),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 13h8M8 16.5h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: '/captions',
  },
  {
    name: t('ours_what_worked', 'What worked'),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M3 17l5-5 4 4 8-8M15 8h5v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: '/results',
  },
  {
    name: t('ours_plan_usage', 'Plan and usage'),
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M4 20V10M10 20V4M16 20v-7M22 20H2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    path: '/plan',
  },
];
