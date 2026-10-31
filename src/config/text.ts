// All user-facing copy lives here. Components import from this file.
export const text = {
  appTitle: "Ruchi's Dumpling Map",
  menu: 'Menu',
  signIn: 'Sign in',
  addSpot: 'Add a spot',
  addSpotSymbol: '+',
  wantToGo: 'Want to go',
  filters: {
    been: 'Been there',
    want: 'Want to go',
    allFoods: 'All foods',
    tagLabel: 'Food type',
  },
  views: {
    label: 'View',
    map: 'Map',
    feed: 'Feed',
  },
  drawer: {
    expand: 'Show more spots',
    collapse: 'Show fewer spots',
  },
  empty: {
    noSpots: 'No spots yet.',
  },
  errors: {
    loadSpots: "Couldn't load spots. Try again later.",
  },
  formatVisitDate: (ymd: string): string =>
    new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
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
