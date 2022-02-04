const asyncRetry = require('async/retry');
const {address} = require('bitcoinjs-lib');
const {decodePsbt} = require('psbt');
const {spawnLightningCluster} = require('ln-docker-daemons');
const {test} = require('@alexbosworth/tap');
const tinysecp = require('tiny-secp256k1');

const {createChainAddress} = require('./../../');
const {fundPsbt} = require('./../../');
const {getChainBalance} = require('./../../');
const {getChainTransactions} = require('./../../');
const {getUtxos} = require('./../../');
const {sendToChainAddress} = require('./../../');

const chainAddressRowType = 'chain_address';
const confirmationCount = 6;
const count = 100;
const description = 'description';
const {fromBech32} = address;
const interval = retryCount => 10 * Math.pow(2, retryCount);
const regtestBech32AddressHrp = 'bcrt';
const times = 20;
const tokens = 1e6;
const txIdHexByteLength = 64;

// Funding a transaction should result in a funded PSBT
test(`Fund PSBT`, async ({end, equal}) => {
  const ecp = (await import('ecpair')).ECPairFactory(tinysecp);

  const {kill, nodes} = await spawnLightningCluster({});

  const [{generate, lnd}] = nodes;

  await generate({count});

  const {address} = await createChainAddress({lnd});
  const [utxo] = (await getUtxos({lnd})).utxos;

  const funded = await asyncRetry({interval, times}, async () => {
    try {
      return await fundPsbt({
        lnd,
        inputs: [{
          transaction_id: utxo.transaction_id,
          transaction_vout: utxo.transaction_vout,
        }],
        outputs: [{address, tokens}],
      });
    } catch (err) {
      // On LND 0.11.1 and below, funding a PSBT is not supported
      if (err.slice().shift() === 501) {
        return;
      }

      throw err;
    }
  });

  // On LND 0.11.1 and below, funding a PSBT is not supported
  if (!funded) {
    await kill({});

    return end();
  }

  const [input] = funded.inputs;

  equal(funded.inputs.length, [utxo].length, 'Got expected number of inputs');
  equal(input.transaction_id, utxo.transaction_id, 'Got expected input tx id');
  equal(input.transaction_vout, utxo.transaction_vout, 'Got expected tx vout');
  equal(input.lock_expires_at > new Date().toISOString(), true, 'Got expires');
  equal(input.lock_id.length, 64, 'Got lock identifier');

  equal(funded.outputs.length, 2, 'Got expected output count');

  const change = funded.outputs.find(n => n.is_change);
  const output = funded.outputs.find(n => !n.is_change);

  equal(change.output_script.length, 44, 'Change address is returned');
  equal(change.tokens, 4998992950, 'Got change output value');

  equal(output.tokens, tokens, 'Got expected tokens output');

  const {data, version} = fromBech32(address);

  const prefix = `${Buffer.from([version]).toString('hex')}14`;

  const expectedOutput = `${prefix}${data.toString('hex')}`;

  equal(output.output_script, expectedOutput, 'Got expected output script');

  const decoded = decodePsbt({ecp, psbt: funded.psbt});

  const [decodedInput] = decoded.inputs;

  equal(decodedInput.sighash_type, 1, 'PSBT has sighash all flag');
  equal(!!decodedInput.witness_utxo.script_pub, true, 'PSBT input address');
  equal(decodedInput.witness_utxo.tokens, 5000000000, 'PSBT has input tokens');

  await kill({});

  return end();
});
