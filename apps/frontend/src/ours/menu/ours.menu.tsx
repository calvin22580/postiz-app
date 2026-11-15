// OURS: our entries in the left menu. Spread into upstream's menu with one
// logged line in components/layout/top.menu.tsx.
export const oursFirstMenu = () => [
  {
    name: 'Business profile',
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
];
