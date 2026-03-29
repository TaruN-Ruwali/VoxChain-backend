const algosdk = require('algosdk');

const algodClient = new algosdk.Algodv2(
  process.env.ALGOD_TOKEN || '',
  process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
  process.env.ALGOD_PORT || 443
);

const indexerClient = new algosdk.Indexer(
  process.env.INDEXER_TOKEN || '',
  process.env.INDEXER_SERVER || 'https://testnet-idx.algonode.cloud',
  process.env.INDEXER_PORT || 443
);

let senderAccount = null;

const loadAccount = () => {
  try {
    const mnemonic = process.env.ALGO_MNEMONIC;
    if (!mnemonic || mnemonic.trim().split(/\s+/).length < 25) {
      console.warn('⚠️  ALGO_MNEMONIC not set — blockchain simulation mode active');
      return null;
    }
    senderAccount = algosdk.mnemonicToSecretKey(mnemonic.trim());
    console.log(`✅ Algorand account loaded: ${senderAccount.addr}`);
    return senderAccount;
  } catch (err) {
    console.warn(`⚠️  Algorand account load failed: ${err.message} — simulation mode active`);
    return null;
  }
};

const checkNodeHealth = async () => {
  try {
    await algodClient.status().do();
    return true;
  } catch {
    return false;
  }
};

const simulateTransaction = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const txId = 'SIM' + Array.from({ length: 49 }, () => chars[Math.floor(Math.random() * 32)]).join('');
  return { txId, confirmedRound: null, simulated: true };
};

const submitVoteTransaction = async (voterId, candidate) => {
  const nodeOk = await checkNodeHealth();
  if (!nodeOk || !senderAccount) return simulateTransaction();

  try {
    const note = algosdk.encodeObj({ app: 'VoxChain', voterId, candidate, ts: Date.now() });
    const suggestedParams = await algodClient.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: senderAccount.addr,
      receiver: senderAccount.addr,
      amount: 0,
      note,
      suggestedParams,
    });
    const signedTxn = txn.signTxn(senderAccount.sk);
    const { txid } = await algodClient.sendRawTransaction(signedTxn).do();
    const confirmation = await algosdk.waitForConfirmation(algodClient, txid, 4);
    console.log(`✅ On-chain tx: ${txid} in round ${confirmation['confirmed-round']}`);
    return { txId: txid, confirmedRound: confirmation['confirmed-round'], simulated: false };
  } catch (err) {
    console.error(`❌ Blockchain tx failed: ${err.message} — falling back to simulation`);
    return simulateTransaction();
  }
};

const verifyTransaction = async (txId) => {
  if (txId.startsWith('SIM')) {
    return { id: txId, simulated: true, message: 'Simulated transaction — no on-chain record' };
  }
  try {
    const result = await indexerClient.lookupTransactionByID(txId).do();
    const tx = result.transaction;
    return {
      id: tx.id,
      sender: tx.sender,
      round: tx['confirmed-round'],
      timestamp: tx['round-time'],
      fee: tx.fee,
      note: tx.note ? (() => { try { return algosdk.decodeObj(Buffer.from(tx.note, 'base64')); } catch { return tx.note; } })() : null,
      simulated: false,
    };
  } catch {
    return null;
  }
};

module.exports = { algodClient, indexerClient, loadAccount, submitVoteTransaction, verifyTransaction };
