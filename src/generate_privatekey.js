import { createEd25519PeerId } from "@libp2p/peer-id-factory";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";

(async function () {
  const id = await createEd25519PeerId();
  const privateKey = uint8ArrayToString(id.privateKey, "base64");
  console.log(privateKey);
})();
