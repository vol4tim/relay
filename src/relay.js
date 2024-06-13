import { noise } from "@chainsafe/libp2p-noise";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { unmarshalPrivateKey } from "@libp2p/crypto/keys";
import { identify } from "@libp2p/identify";
// import { mdns } from "@libp2p/mdns";
import { mplex } from "@libp2p/mplex";
import { createFromPrivKey } from "@libp2p/peer-id-factory";
// import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import fs from "fs";
import { createLibp2p } from "libp2p";
import path, { dirname } from "path";
import { fromString as uint8ArrayFromString } from "uint8arrays/from-string";
import { fileURLToPath } from "url";

const __dirname = path.resolve();
const __filename = fileURLToPath(import.meta.url);

const loadJSON = path =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));

let fileConfig = path.resolve(dirname(__filename), "../config.json");
if (process.argv[2] === "--config") {
  fileConfig = path.resolve(__dirname, process.argv[3]);
}

if (!fs.existsSync(fileConfig)) {
  console.log("Not found file config", fileConfig);
  process.exit(0);
}

const config = loadJSON(fileConfig);

const logger = (...params) => {
  console.log(
    `[${new Intl.DateTimeFormat("ru", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h24"
    }).format(new Date())}]`,
    ...params
  );
};

const bl = config.bl || [];

async function main() {
  const privateKey = uint8ArrayFromString(config.privateKey, "base64");
  const key = await unmarshalPrivateKey(privateKey);
  const id = await createFromPrivKey(key);

  const node = await createLibp2p({
    addresses: config.addresses,
    peerId: id,
    transports: [
      // tcp(),
      webSockets({
        filter: filters.all
      })
    ],
    connectionEncryption: [noise()],
    streamMuxers: [
      mplex({
        maxStreamBufferSize: 10000000,
        maxMsgSize: 131072 * 100
      })
    ],
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        reservations: {
          defaultDataLimit: BigInt(131072 * 10),
          applyDefaultLimit: false,
          maxReservations: 500,
          defaultDurationLimit: 25 * 60 * 1000
        }
      })
    },
    connectionGater: {
      denyInboundUpgradedConnection: async peerId => {
        if (bl.length && bl.includes(peerId.toString())) {
          console.log("skip black list", peerId.toString());
          return true;
        }
        return false;
      }
    },
    connectionManager: config.connectionManager || {}
  });

  logger(`Node started with id ${node.peerId.toString()}`);
  logger("Listening on:");
  node.getMultiaddrs().forEach(ma => console.log(ma.toString()));

  let connections = [];

  function updateConnectionsList() {
    connections = node.getConnections().map(item => {
      return item.remoteAddr.toString();
    });
    logger("Update Connections List", connections);
  }

  node.addEventListener("connection:open", event => {
    logger("connected", event.detail.remoteAddr.toString());
    updateConnectionsList();
  });

  node.addEventListener("connection:close", event => {
    logger("disconected", event.detail.remoteAddr.toString());
    updateConnectionsList();
  });
}

main();
