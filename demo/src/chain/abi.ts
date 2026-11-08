// Human-readable ABIs for ethers. Kept in sync with contracts/ShahnamehStory.sol and basic-eth-wallet/contracts/SmartContractWallet.sol.
const CHAPTER = "tuple(address author, uint64 createdAt, uint32 parent, uint8 parentBranch, string title, string textEn, string textFa, string[] labelsEn, string[] labelsFa)";
export const STORY_ABI = [
  `function writeChapter(uint32 parent, uint8 branch, tuple(string title, string textEn, string textFa, string[] labelsEn, string[] labelsFa) chapter) returns (uint32 id)`,
  "function chooseBranch(uint32 chapter, uint8 branch)",
  "function chapterCount() view returns (uint256)",
  `function getChapter(uint32 id) view returns (${CHAPTER})`,
  "function childOf(uint32 id, uint8 branch) view returns (uint32)",
  "function openBranches() view returns (uint256)",
  "function nextWriteAt(address) view returns (uint256)",
  "function branchChoices(uint32, uint8) view returns (uint256)",
  "function hasChosen(uint32, address) view returns (bool)",
  "function COOLDOWN() view returns (uint256)",
  "event ChapterWritten(uint32 indexed id, uint32 indexed parent, uint8 parentBranch, address indexed author, string title, string textEn, string textFa, string[] labelsEn, string[] labelsFa)",
  "event BranchChosen(address indexed reader, uint32 indexed chapter, uint8 branch, uint32 next)",
  "error CooldownActive(uint256 availableAt)", "error InvalidCooldown()", "error EmptyTitle()", "error TitleTooLong()", "error EmptyText()", "error TextTooLong()",
  "error BadBranchCount()", "error LabelCountMismatch()", "error EmptyLabel()", "error LabelTooLong()", "error UnknownChapter()", "error UnknownBranch()",
  "error BranchTaken()", "error BranchNotWritten()", "error LastOpenBranch()", "error AlreadyChosen()",
];
export const WALLET_ABI = [
  "function owner() view returns (address)", "function threshold() view returns (uint256)", "function guardianCount() view returns (uint256)",
  "function guardians(address) view returns (bool)", "function allowance(address) view returns (uint256)", "function proposedOwner() view returns (address)",
  "function recoveryVotes() view returns (uint256)", "function hasApproved(address) view returns (bool)",
  "function setGuardian(address guardian, bool isGuardian)", "function setThreshold(uint256 newThreshold)", "function setAllowance(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)", "function proposeNewOwner(address newOwner)", "function cancelRecovery()",
  "event Deposited(address indexed from, uint256 amount)", "event Sent(address indexed by, address indexed to, uint256 amount)",
  "event GuardianSet(address indexed guardian, bool isGuardian)", "event ThresholdSet(uint256 threshold)", "event AllowanceSet(address indexed spender, uint256 amount)",
  "event RecoveryProposed(address indexed proposer, address indexed newOwner, uint256 round)", "event RecoveryApproved(address indexed guardian, address indexed newOwner, uint256 votes)",
  "event RecoveryCancelled(address indexed by, address indexed newOwner)", "event OwnerChanged(address indexed previousOwner, address indexed newOwner)",
  "error NotOwner()", "error NotGuardian()", "error AlreadyVoted()", "error InvalidNewOwner()", "error InvalidThreshold()", "error NotAllowed()",
  "error ExceedsAllowance()", "error TransferFailed()", "error ZeroAddress()", "error NoRecovery()",
];
