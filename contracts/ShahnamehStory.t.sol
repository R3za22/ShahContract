// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import {ShahnamehStory} from "./ShahnamehStory.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function assume(bool) external pure;
}

/// @dev Native Hardhat 3 Solidity fuzz tests (no forge-std needed).
contract ShahnamehStoryFuzzTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ShahnamehStory private story;

    function _chapter(string memory a, string memory b) private pure returns (ShahnamehStory.NewChapter memory n) {
        n.title = "T";
        n.textEn = "e";
        n.textFa = "f";
        n.labelsEn = new string[](2);
        n.labelsFa = new string[](2);
        n.labelsEn[0] = "ok";
        n.labelsEn[1] = a;
        n.labelsFa[0] = "ok";
        n.labelsFa[1] = b;
    }

    function setUp() public {
        story = new ShahnamehStory(60, _chapter("go", "stay"));
    }

    function testFuzz_labelLimitIsExactlyThirtyOneBytes(string calldata en, string calldata fa) public {
        bool valid = bytes(en).length > 0 && bytes(en).length <= 31 && bytes(fa).length > 0 && bytes(fa).length <= 31;
        bool accepted = true;
        try story.writeChapter(0, 0, _chapter(en, fa)) {} catch {
            accepted = false;
        }
        require(accepted == valid, "label limit mismatch");
        require(story.openBranches() >= 1, "story ran out of branches");
    }

    function testFuzz_cooldownIsEnforcedPerAddress(uint32 wait) public {
        story.writeChapter(0, 0, _chapter("a", "b"));
        vm.warp(block.timestamp + wait);
        bool accepted = true;
        try story.writeChapter(0, 1, _chapter("a", "b")) {} catch {
            accepted = false;
        }
        require(accepted == (wait >= 60), "cooldown mismatch");
        vm.prank(address(0xBEEF));
        story.writeChapter(1, 0, _chapter("a", "b")); // another address is unaffected
    }

    function testFuzz_titleAndTextCaps(string calldata title, string calldata en, string calldata fa) public {
        ShahnamehStory.NewChapter memory n = _chapter("a", "b");
        n.title = title;
        n.textEn = en;
        n.textFa = fa;
        bool valid = bytes(title).length > 0 && bytes(title).length <= 63 && bytes(en).length > 0 && bytes(fa).length > 0
            && bytes(en).length + bytes(fa).length <= 1200;
        bool accepted = true;
        try story.writeChapter(0, 0, n) {} catch {
            accepted = false;
        }
        require(accepted == valid, "title/text cap mismatch");
    }
}
