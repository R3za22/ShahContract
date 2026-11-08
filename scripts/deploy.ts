// Deploys ShahnamehStory with the opening chapter from demo/content/story.json. Defaults to the in-process
// Hardhat network (a dry run); nothing is deployed unless you pass --network sepolia yourself.
//   npm run deploy:dry
//   SEPOLIA_RPC_URL=... SEPOLIA_PRIVATE_KEY=... npm run deploy:sepolia
import { readFileSync } from "node:fs";
import { network } from "hardhat";

const story = JSON.parse(readFileSync("demo/content/story.json", "utf8"));
const root = story.nodes[story.root];
const cooldown = Number(process.env.COOLDOWN_SECONDS ?? "300");
const title = story.episodes[String(root.ep)].en;

const { ethers } = await network.create();
const contract = await ethers.deployContract("ShahnamehStory", [
  cooldown,
  [title, root.en.text, root.fa.text, root.en.choices, root.fa.choices],
]);
await contract.waitForDeployment();
console.log(`ShahnamehStory deployed at ${await contract.getAddress()} (cooldown ${cooldown}s)`);
console.log("Put the address in VITE_STORY_ADDRESS to use it from the live adapter.");
