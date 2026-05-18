// SPDX-License-Identifier: MIT

pragma solidity ^0.8.35;

contract Adventure {
    //Gotta encode and decode the choice strings on the frontend

    event Situation(uint indexed id, string situationText, bytes32[] choiceTexts);


    //fromSituation    //choiceNum   //toSituation
    mapping(uint => mapping(uint => uint)) links;
    //situation    //number of choices
    mapping(uint => uint) options;

    //situation     //person who wrote it
    mapping(uint => address) authors;
    //author            //name
    mapping(address => string) signatures;

    //Total number of situations
    uint situationCount;
    //Un-closed pathways
    uint pathwayCount;



    constructor(string memory situationText, bytes32[] memory choiceTexts) {
        require(choiceTexts.length > 0,"constructor failed because choises were empty");
        require(bytes(situationText).length > 0,"constructor failed because situationText were empty");


        //Define the option count
        options[0] = choiceTexts.length;

        //Set how many remaining open paths there are
        pathwayCount = choiceTexts.length;

        //Sign your name
        authors[0] = msg.sender;

        emit Situation(0,situationText,choiceTexts);
    }

    function addSituation(
        uint fromSituation,
        uint fromChoice,
        string memory situationText,
        bytes32[] memory choiceTexts) public{
        //Make sure there is still at least one open pathway
        require(pathwayCount + choiceTexts.length > 1, "there was no open pathway");

        //Make sure they didn't leave situationText blank
        require(bytes(situationText).length > 0,"situation text was blank");

        //Make sure this situation.choice actually exists
        require(fromChoice < options[fromSituation],"options");

        //Make sure this situation.choice hasn't been defined
        require(links[fromSituation][fromChoice] == 0,"choice");

        for(uint i = 0; i < choiceTexts.length; i++) {
            require(choiceTexts[i] != bytes32(0), "choice text cannot be empty");
        }

        //Increment situationCount, and this is the new situation num
        situationCount++;

        //Adjust pathwayCount
        pathwayCount += choiceTexts.length - 1;

        //Set pointer from previous situation
        links[fromSituation][fromChoice] = situationCount;

        //Set many options there are for this situation
        options[situationCount] = choiceTexts.length;

        //Sign your name
        authors[situationCount] = msg.sender;

        emit Situation(situationCount,situationText,choiceTexts);

    }

    function addSignature(string memory signature) public {
        require(bytes(signature).length > 0, "signature cannot be empty"); // ADDED validation
        signatures[msg.sender] = signature;
    }

    function getSignature(uint situation) public view returns(string memory) {
        return signatures[authors[situation]];
    }

    function getAuthor(uint situation) public view returns(address) {
        return authors[situation];
    }

    function getPathwayCount() public view returns(uint) {
        return pathwayCount;
    }

    function getNextSituation(uint fromSituation, uint fromChoice) public view returns(uint) {
        return links[fromSituation][fromChoice];
    }
}