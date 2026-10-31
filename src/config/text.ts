// All user-facing copy lives here. Components import from this file.
export const text = {
  appTitle: "Ruchi's Dumpling Map",
  menu: 'Menu',
  signIn: 'Sign in',
  filters: {
    been: 'Been there',
    want: 'Want to go',
    allFoods: 'All foods',
  },
  views: {
    map: 'Map',
    feed: 'Feed',
  },
  preview: {
    defaultDescription: 'Ruchi\'s favorite dumpling spots, mapped.',
    wantToGo: 'On the list to try.',
  },
  rating: {
    setLabel: (n: number): string => `Rate ${n} out of 5`,
    valueLabel: (value: number | null): string =>
      value === null ? 'Not rated' : `Rated ${value} out of 5`,
  },
  units: {
    miles: 'mi',
  },
  notFound: "We couldn't find that spot.",
} as const;
