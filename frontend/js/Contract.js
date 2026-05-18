const Contract  = () => {
    if (typeof web3 !== 'undefined') {
        console.log('web3 defined');
        web3 = new Web3(web3.currentProvider);
    } else {
        let provider;
        if(window.ethereum) {
            console.log('window.ethereum');
            provider = window.ethereum;
        }else if(window.web3 && window.web3.currentProvider){
            console.log('provider exists');
            provider = window.web3.currentProvider;
        }else{
            console.log('infura');
            provider = new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/2d9d3459d7ef4188a43973a98b27cef7");
        }
        web3 = new Web3(provider);

    }



    const address = "0xd9145CCE52D386f254917e481eB44e9943F39138";    //Mainnet

    const abi = [
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "uint256",
                    "name": "id",
                    "type": "uint256"
                },
                {
                    "indexed": false,
                    "internalType": "string",
                    "name": "situationText",
                    "type": "string"
                },
                {
                    "indexed": false,
                    "internalType": "bytes32[]",
                    "name": "choiceTexts",
                    "type": "bytes32[]"
                }
            ],
            "name": "Situation",
            "type": "event"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "signature",
                    "type": "string"
                }
            ],
            "name": "addSignature",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "fromSituation",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "fromChoice",
                    "type": "uint256"
                },
                {
                    "internalType": "string",
                    "name": "situationText",
                    "type": "string"
                },
                {
                    "internalType": "bytes32[]",
                    "name": "choiceTexts",
                    "type": "bytes32[]"
                }
            ],
            "name": "addSituation",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "string",
                    "name": "situationText",
                    "type": "string"
                },
                {
                    "internalType": "bytes32[]",
                    "name": "choiceTexts",
                    "type": "bytes32[]"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "constructor"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "situation",
                    "type": "uint256"
                }
            ],
            "name": "getAuthor",
            "outputs": [
                {
                    "internalType": "address",
                    "name": "",
                    "type": "address"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "fromSituation",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "fromChoice",
                    "type": "uint256"
                }
            ],
            "name": "getNextSituation",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getPathwayCount",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "situation",
                    "type": "uint256"
                }
            ],
            "name": "getSignature",
            "outputs": [
                {
                    "internalType": "string",
                    "name": "",
                    "type": "string"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]

    let instance = new web3.eth.Contract(
        abi,
        address
    );

    let account, network;
    let contract = {
        check_metamask: () => {
            return account !== "0x0";
        },
        check_network: () => {
            return String(network) === '1';  //Mainnet
        },

        init: async () => {
            await contract.get_account();
            network = await web3.eth.net.getId();
        },
        get_account: async () => {

            try{
                let accounts;
                if(window.ethereum && ethereum.enable){
                    accounts = await ethereum.enable();

                    if(!accounts){
                        console.log('fallback to hard get');
                        accounts = await web3.eth.getAccounts();
                    }

                }else{
                    accounts = await web3.eth.getAccounts();
                }

                account = accounts[0];
                console.log("got account");
                console.log(account);

            }catch(e){
                console.log('denied');
                console.log('account set to 0x0');
                account = "0x0";
            }


        },




        get_situation: async (id) => {
            const situation = await instance.getPastEvents("Situation", {
                filter: {id: [id]},
                fromBlock: 7073631,
                toBlock: 'latest'
            }).then(events => {
                return {
                    found: true,
                    situationText: events[0].returnValues.situationText,
                    choiceText: DeChoices(events[0].returnValues.choiceTexts)
                }
            }).catch(error => {
                console.log('failed to get situation',error);
                return {
                    found: false,
                    error: error,
                }
            });

            return situation;
        },
        get_signature: async (situation) => {
            return await instance.methods.get_signature(situation).call();
        },
        get_author: async (situation) => {
            return await instance.methods.get_author(situation).call();
        },
        get_closable: async () =>{
            let pathwayCount = await instance.methods.get_pathwayCount().call();
            return (String(pathwayCount) !== '1');
        },
        get_next_situation: async (fromSituation, fromChoice) => {
            return await instance.methods.get_next_situation(fromSituation, fromChoice).call();
        },
        add_situation: (fromSituation, fromChoice, situationText, choiceTexts, callback) => {
            //TODO: get the callback,
            try{

                let toSend = instance.methods.add_situation(fromSituation, fromChoice, situationText, Choices(choiceTexts));

                // let tx = toSend.send({
                //     from:account
                // });


                web3.eth.sendTransaction({
                    from: account,
                    to: address,
                    data:toSend.encodeABI()
                },(err,hash)=>{
                    callback({
                        accepted: !err,
                        hash: hash
                    });
                });

                console.log('tx sent');
            }catch(err){
                console.log('tx failed');
            }
            return {
                accepted: true,
                hash: '0x0'
            }
        },
        add_signature: (signature,callback) => {
            let toSend = instance.methods.add_signature(signature);
            // let tx = toSend.send({
            //     from:account
            // });

            web3.eth.sendTransaction({
                from: account,
                to: address,
                data:toSend.encodeABI()
            },(err,hash)=>{
                callback({
                   accepted: !err,
                   hash: hash
                });
            });


            // return {
            //     accepted: true,
            //     hash: '0x0',
            // }
        },
    }
    contract.init();

    function Choice(choiceText){
        return web3.utils.fromAscii(choiceText);
    }
    function Choices(choiceTexts){
        let choices = [];
        choiceTexts.forEach( choiceText =>{
            choices.push(Choice(choiceText));
        });
        return choices;
    }
    function DeChoice(choiceText){
        let converted = web3.utils.toAscii(choiceText);
        converted = converted.replace(/\u0000/g, '');
        return converted;
    }
    function DeChoices(choiceTexts){
        let choices = [];
        choiceTexts.forEach( choiceText =>{
            choices.push(DeChoice(choiceText));
        });
        return choices;
    }
    return contract;


}

