const {createChainAddress} = require('./../lightning');
const {returnJson} = require('./../async-util');
const Router = require('./router');

/** Get an addresses router

  {
    lnd: <LND API>
    log: <Log Function>
  }

  @returns
  <Router Object>
*/
module.exports = ({lnd, log}) => {
  const router = Router({});

  // Add an address
  router.post('/', ({}, res) => {
    return createChainAddress({lnd}, returnJson({log, res}));
  });

  return router;
};

