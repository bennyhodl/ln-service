const connectionFailure = '14 UNAVAILABLE: Connect Failed';
const expectedMnemonicLength = 24;

/** Create a wallet seed

  {
    lnd: <LND GRPC API Object>
    [passphrase]: <Seed Passphrase String>
  }

  @returns via cbk
  {
    seed: <Cipher Seed Mnemonic String>
  }
*/
module.exports = ({lnd, passphrase}, cbk) => {
  if (!lnd) {
    return cbk([400, 'ExpectedLndForSeedCreation']);
  }

  const pass = !passphrase ? undefined : Buffer.from(passphrase, 'utf8');

  return lnd.genSeed({aezeed_passphrase: pass}, (err, res) => {
    if (!!err && err.message === connectionFailure) {
      return cbk([503, 'UnexpectedConnectionFailure']);
    }

    if (!!err) {
      return cbk([503, 'UnexpectedCreateSeedError', err]);
    }

    if (!res) {
      return cbk([503, 'ExpectedResponseForSeedCreation']);
    }

    if (!Array.isArray(res.cipher_seed_mnemonic)) {
      return cbk([503, 'ExpectedCipherSeedMnemonic', res]);
    }

    if (res.cipher_seed_mnemonic.length !== expectedMnemonicLength) {
      return cbk([503, 'UnexpectedCipherSeedMnemonicLength', res]);
    }

    return cbk(null, {seed: res.cipher_seed_mnemonic.join(' ')});
  });
};
