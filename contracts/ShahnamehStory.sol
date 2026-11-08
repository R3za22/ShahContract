// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

/// @title ShahnamehStory
/// @notice A crowd-written, branching retelling of the Shahnameh, stored on-chain in English and Persian.
/// @dev Original work. A chapter ends in two or three branches (or is an ending). A branch starts "open";
///      the first valid `writeChapter` aimed at it fills it for good. Chapters can never be edited.
///      Abuse limits: byte caps on every string, a per-address cooldown between writes, and a rule that the
///      last open branch of the whole story can never be closed (so nobody can end the story with a spam ending).
contract ShahnamehStory {
    /// @notice Longest branch label, in bytes (Persian letters take two bytes each).
    uint256 public constant MAX_LABEL_BYTES = 31;
    /// @notice Longest chapter title, in bytes.
    uint256 public constant MAX_TITLE_BYTES = 63;
    /// @notice Longest chapter body, English and Persian together, in bytes.
    uint256 public constant MAX_TEXT_BYTES = 1200;
    /// @notice Fewest branches a non-ending chapter offers.
    uint256 public constant MIN_BRANCHES = 2;
    /// @notice Most branches a chapter offers.
    uint256 public constant MAX_BRANCHES = 3;
    /// @notice Longest cooldown the deployer may configure.
    uint256 public constant MAX_COOLDOWN = 1 days;

    struct Chapter {
        address author;
        uint64 createdAt;
        uint32 parent;
        uint8 parentBranch;
        string title;
        string textEn;
        string textFa;
        string[] labelsEn;
        string[] labelsFa;
    }

    /// @notice What an author submits for a chapter.
    struct NewChapter {
        string title;
        string textEn;
        string textFa;
        string[] labelsEn;
        string[] labelsFa;
    }

    /// @notice Seconds an address must wait between two chapters.
    uint256 public immutable COOLDOWN;

    Chapter[] private _chapters;
    mapping(uint32 => mapping(uint8 => uint32)) private _child;
    mapping(address => uint256) public nextWriteAt;
    mapping(uint32 => mapping(uint8 => uint256)) public branchChoices;
    mapping(uint32 => mapping(address => bool)) public hasChosen;
    /// @notice Branches that still wait for a chapter, across the whole story.
    uint256 public openBranches;

    event ChapterWritten(
        uint32 indexed id,
        uint32 indexed parent,
        uint8 parentBranch,
        address indexed author,
        string title,
        string textEn,
        string textFa,
        string[] labelsEn,
        string[] labelsFa
    );
    event BranchChosen(address indexed reader, uint32 indexed chapter, uint8 branch, uint32 next);

    error InvalidCooldown();
    error CooldownActive(uint256 availableAt);
    error EmptyTitle();
    error TitleTooLong();
    error EmptyText();
    error TextTooLong();
    error BadBranchCount();
    error LabelCountMismatch();
    error EmptyLabel();
    error LabelTooLong();
    error UnknownChapter();
    error UnknownBranch();
    error BranchTaken();
    error BranchNotWritten();
    error LastOpenBranch();
    error AlreadyChosen();

    /// @param cooldown Seconds between writes per address (at most one day, zero allowed for local tests).
    /// @param opening The opening chapter; it must offer two or three branches.
    constructor(uint256 cooldown, NewChapter memory opening) {
        if (cooldown > MAX_COOLDOWN) revert InvalidCooldown();
        COOLDOWN = cooldown;
        _validate(opening);
        if (opening.labelsEn.length == 0) revert BadBranchCount(); // the story must start with somewhere to go
        _store(0, 0, opening);
        openBranches = opening.labelsEn.length;
    }

    /// @notice Write the chapter that continues an open branch.
    /// @param parent Chapter whose branch is being continued.
    /// @param branch Index of the open branch (0 to 2).
    /// @param chapter The new chapter. Empty labels make it an ending, otherwise two or three branches.
    /// @return id The new chapter's id.
    function writeChapter(uint32 parent, uint8 branch, NewChapter calldata chapter) external returns (uint32 id) {
        uint256 availableAt = nextWriteAt[msg.sender];
        if (block.timestamp < availableAt) revert CooldownActive(availableAt);
        if (parent >= _chapters.length) revert UnknownChapter();
        if (branch >= _chapters[parent].labelsEn.length) revert UnknownBranch();
        if (_child[parent][branch] != 0) revert BranchTaken();
        _validate(chapter);

        // This write fills one branch and opens labelsEn.length new ones; the story must keep at least one.
        uint256 openAfter = openBranches - 1 + chapter.labelsEn.length;
        if (openAfter == 0) revert LastOpenBranch();

        nextWriteAt[msg.sender] = block.timestamp + COOLDOWN;
        openBranches = openAfter;
        id = _store(parent, branch, chapter);
        _child[parent][branch] = id;
    }

    /// @notice Record which branch you took. One choice per reader per chapter; it only feeds the popularity count.
    /// @param chapter Chapter you are reading.
    /// @param branch Branch you chose; it must already be written.
    function chooseBranch(uint32 chapter, uint8 branch) external {
        if (chapter >= _chapters.length) revert UnknownChapter();
        if (branch >= _chapters[chapter].labelsEn.length) revert UnknownBranch();
        uint32 next = _child[chapter][branch];
        if (next == 0) revert BranchNotWritten();
        if (hasChosen[chapter][msg.sender]) revert AlreadyChosen();
        hasChosen[chapter][msg.sender] = true;
        branchChoices[chapter][branch] += 1;
        emit BranchChosen(msg.sender, chapter, branch, next);
    }

    /// @notice Number of chapters written so far, including the opening one.
    function chapterCount() external view returns (uint256) {
        return _chapters.length;
    }

    /// @notice Full chapter record.
    /// @param id Chapter id.
    function getChapter(uint32 id) external view returns (Chapter memory) {
        if (id >= _chapters.length) revert UnknownChapter();
        return _chapters[id];
    }

    /// @notice The chapter that continues `branch` of `id`, or 0 while the branch is open.
    /// @param id Chapter id.
    /// @param branch Branch index.
    function childOf(uint32 id, uint8 branch) external view returns (uint32) {
        return _child[id][branch];
    }

    function _store(uint32 parent, uint8 branch, NewChapter memory n) private returns (uint32 id) {
        id = uint32(_chapters.length);
        Chapter storage c = _chapters.push();
        c.author = msg.sender;
        c.createdAt = uint64(block.timestamp);
        c.parent = parent;
        c.parentBranch = branch;
        c.title = n.title;
        c.textEn = n.textEn;
        c.textFa = n.textFa;
        for (uint256 i = 0; i < n.labelsEn.length; i++) {
            c.labelsEn.push(n.labelsEn[i]);
            c.labelsFa.push(n.labelsFa[i]);
        }
        emit ChapterWritten(id, parent, branch, msg.sender, n.title, n.textEn, n.textFa, n.labelsEn, n.labelsFa);
    }

    function _validate(NewChapter memory n) private pure {
        uint256 titleLen = bytes(n.title).length;
        if (titleLen == 0) revert EmptyTitle();
        if (titleLen > MAX_TITLE_BYTES) revert TitleTooLong();
        uint256 enLen = bytes(n.textEn).length;
        uint256 faLen = bytes(n.textFa).length;
        if (enLen == 0 || faLen == 0) revert EmptyText();
        if (enLen + faLen > MAX_TEXT_BYTES) revert TextTooLong();
        uint256 count = n.labelsEn.length;
        if (count != n.labelsFa.length) revert LabelCountMismatch();
        if (count != 0 && (count < MIN_BRANCHES || count > MAX_BRANCHES)) revert BadBranchCount();
        for (uint256 i = 0; i < count; i++) {
            _checkLabel(n.labelsEn[i]);
            _checkLabel(n.labelsFa[i]);
        }
    }

    function _checkLabel(string memory label) private pure {
        uint256 len = bytes(label).length;
        if (len == 0) revert EmptyLabel();
        if (len > MAX_LABEL_BYTES) revert LabelTooLong();
    }
}
