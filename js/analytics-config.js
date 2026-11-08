// Public project API key, not a personal API key. Live capture is restricted to the configured production origins.
export const analyticsConfig = Object.freeze({
  site:'cinema',
  apiHost:'https://us.i.posthog.com',
  projectToken:'phc_sPLnjV7VEbX7WewEGmPcGj4CHaHBTG3nSgizerFTZfoM',
  productionOrigins:[
    'https://cinema.mariustang.com',
    'https://ember-film-experiment.vercel.app'
  ],
  liveEnabled:true
});
