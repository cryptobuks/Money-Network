angular.module('MoneyNetwork')

    // MoneyNetworkWService:
    // - wallet functions

    .factory('MoneyNetworkWService', ['$timeout', '$rootScope', '$window', '$location', 'dateFilter', 'MoneyNetworkHubService', '$sanitize',
                             function($timeout, $rootScope, $window, $location, date, moneyNetworkHubService, $sanitize)
    {
        var service = 'MoneyNetworkWService' ;
        console.log(service + ' loaded') ;

        function debug (keys, text) {
            MoneyNetworkHelper.debug(keys, text) ;
        } // debug

        // cache some important informations from zeronet files
        // - user_seq: from users array in data.json file. using "pubkey" as index to users array
        // - user_seqs: from users array in data.json file.
        // - files_optional: from content.json file. loaded at startup and updated after every sign and publish
        var z_cache = moneyNetworkHubService.get_z_cache() ;

        function detected_client_log_out (pgm) {
            if (z_cache.user_id) return false ;
            console.log(pgm + 'stop. client log out. stopping ' + pgm + ' process') ;
            return true ;
        }

        // import functions from other services
        function get_my_user_hub (cb) {
            moneyNetworkHubService.get_my_user_hub(cb) ;
        }

        // setup MoneyNetworkLib. Most important. inject ZeroFrame into library
        MoneyNetworkAPILib.config({
            debug: true,
            ZeroFrame: ZeroFrame,
            optional: moneyNetworkHubService.get_z_content_optional()
        }) ;

        var SESSION_INFO_KEY = '_$session_info' ; // special key used for session restore password. see pubkeys, get_password and password messages
        function get_session_info_key() {
            return SESSION_INFO_KEY ;
        }

        // load/save sessions in ls
        var ls_sessions ;
        function ls_get_sessions () {
            var pgm = service + '.ls_get_sessions: ' ;
            var sessions_str, sessions, sessionid, session_info, migrate, delete_sessions, balance, i, balance_row, key ;
            if (ls_sessions) return ls_sessions ; // already loaded
            sessions_str = MoneyNetworkHelper.getItem('sessions') ;
            if (!sessions_str) return {} ;
            sessions = JSON.parse(sessions_str) ;
            delete_sessions = [] ;
            for (sessionid in sessions) {
                session_info = sessions[sessionid] ;
                if (session_info.hasOwnProperty('$session_password')) {
                    // migrate from old to new session info key
                    session_info[SESSION_INFO_KEY] = session_info['$session_password'] ;
                    delete session_info['$session_password'] ;
                }
                if (!session_info.hasOwnProperty(SESSION_INFO_KEY)) {
                    delete_sessions.push(sessionid) ;
                    continue ;
                }
                if (!session_info[SESSION_INFO_KEY].last_request_at) delete_sessions.push(sessionid) ;
            }
            while (delete_sessions.length) {
                sessionid = delete_sessions.shift() ;
                delete sessions[sessionid] ;
            }
            console.log(pgm + 'sessions (before cleanup) = ' + JSON.stringify(sessions)) ;
            //sessions = {
            //    "wslrlc5iomh45byjnblebpvnwheluzzdhqlqwvyud9mu8dtitus3kjsmitc1": {
            //        "_$session_info": {
            //            "url": "/1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
            //            "password": "U2FsdGVkX18MyosYqdGVowB1nw/7Nm2nbzATu3TexEXMig7rjInIIr13a/w4G5TzFLFz9GE+rqGZsqRP+Ms0Ez3w8cA9xNhPjtrhOaOkT1M=",
            //            "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuM/Sevlo2UYUkTVteBnnUWpsd\n5JjAUnYhP0M2o36da15z192iNOmd26C+UMg0U8hitK8pOJOLiWi8x6TjvnaipDjc\nIi0p0l3vGBEOvIyNEYE7AdfGqW8eEDzzl9Cezi1ARKn7gq1o8Uk4U2fjkm811GTM\n/1N9IwACfz3lGdAm4QIDAQAB\n-----END PUBLIC KEY-----",
            //            "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
            //            "last_request_at": 1504273096866,
            //            "done": {
            //                "1503315223138": 1503315232562,
            //                ...
            //                "1504273096866": 1504273097557
            //            },
            //            "balance": [{
            //                "code": "tBTC",
            //                "amount": 1.3,
            //                "balance_at": 1504265571720,
            //                "sessionid": "wslrlc5iomh45byjnblebpvnwheluzzdhqlqwvyud9mu8dtitus3kjsmitc1",
            //                "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74",
            //                "name": "Test Bitcoin",
            //                "url": "https://en.bitcoin.it/wiki/Testnet",
            //                "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}],
            //                "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
            //                "wallet_title": "MoneyNetworkW2",
            //                "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro",
            //                "currencies": [{
            //                    "code": "tBTC",
            //                    "name": "Test Bitcoin",
            //                    "url": "https://en.bitcoin.it/wiki/Testnet",
            //                    "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}]
            //                }]
            //            }],
            //            "currencies": [{
            //                "code": "tBTC",
            //                "name": "Test Bitcoin",
            //                "url": "https://en.bitcoin.it/wiki/Testnet",
            //                "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}]
            //            }],
            //            "balance_at": 1504265571720,
            //            "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74"
            //        }
            //    }
            //};
            for (sessionid in sessions) {
                session_info = sessions[sessionid][SESSION_INFO_KEY];
                delete session_info.currencies ;
                balance = session_info.balance ;
                if (!balance || !balance.length) continue ;
                for (i=0 ; i<balance.length ; i++) {
                    balance_row = balance[i] ;
                    for (key in balance_row) {
                        if (['code','amount'].indexOf(key) != -1) continue ;
                        delete balance_row[key] ;
                    } // for key
                } // for i
            } // for sessionid
            console.log(pgm + 'sessions (after cleanup) = ' + JSON.stringify(sessions)) ;
            //sessions = {
            //    "wslrlc5iomh45byjnblebpvnwheluzzdhqlqwvyud9mu8dtitus3kjsmitc1": {
            //        "_$session_info": {
            //            "url": "/1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
            //            "password": "U2FsdGVkX18MyosYqdGVowB1nw/7Nm2nbzATu3TexEXMig7rjInIIr13a/w4G5TzFLFz9GE+rqGZsqRP+Ms0Ez3w8cA9xNhPjtrhOaOkT1M=",
            //            "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuM/Sevlo2UYUkTVteBnnUWpsd\n5JjAUnYhP0M2o36da15z192iNOmd26C+UMg0U8hitK8pOJOLiWi8x6TjvnaipDjc\nIi0p0l3vGBEOvIyNEYE7AdfGqW8eEDzzl9Cezi1ARKn7gq1o8Uk4U2fjkm811GTM\n/1N9IwACfz3lGdAm4QIDAQAB\n-----END PUBLIC KEY-----",
            //            "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
            //            "last_request_at": 1504273096866,
            //            "done": {
            //                "1503315223138": 1503315232562,
            //                "1503916247431": 1503916247859,
            //                "1504261657652": 1504261664116,
            //                "1504261977720": 1504261982693,
            //                "1504273004817": 1504273005849,
            //                "1504273034505": 1504273035560,
            //                "1504273044607": 1504273045387,
            //                "1504273096866": 1504273097557
            //            },
            //            "balance": [{"code": "tBTC", "amount": 1.3}],
            //            "currencies": [{
            //                "code": "tBTC",
            //                "name": "Test Bitcoin",
            //                "url": "https://en.bitcoin.it/wiki/Testnet",
            //                "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}]
            //            }],
            //            "balance_at": 1504265571720,
            //            "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74"
            //        }
            //    }
            //};


            return sessions ;
        } // ls_get_sessions
        function ls_save_sessions () {
            var sessions_str ;
            sessions_str = JSON.stringify(ls_sessions) ;
            MoneyNetworkHelper.setItem('sessions', sessions_str) ;
            MoneyNetworkHelper.ls_save() ;
        } // ls_save_sessions ;

        // load old sessions from ls and listen to new incoming messages
        function create_sessions() {
            var pgm = service + '.create_sessions: ';
            var sessionid, session_info, encrypt, prvkey, userid2 ;

            console.log(pgm + 'todo: add callback to create_sessions. some tasks must run after sessions have been created (get_currencies)') ;

            // create a MoneyNetworkAPI object for each session (listen for incoming messages)
            prvkey = MoneyNetworkHelper.getItem('prvkey') ;
            userid2 = MoneyNetworkHelper.getUserId() ;

            // console.log(pgm + 'setting this_session_userid2 = ' + userid2) ;
            MoneyNetworkAPILib.config({this_session_prvkey: prvkey, this_session_userid2: userid2}) ;

            console.log(pgm + 'todo: pubkey+pubkey2 combinations (other session) should be unique. only one sessionid is being used by the other session. last used sessionid is the correct session');
            //session_info = {
            //    "password":"U2FsdGVkX1+6+X4pSDQOf8/Bb+3xG+nFQDyhr3/7syi+wYXKEZ6UL49dB2ftq1gmC5/LKfI2XfJS2fEsEy5CYscRBDuoUxJEqKNwiiiiXBA=",
            //    "pubkey":"-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsOMfAvHPTp0K9qZfoItdJ9898\nU3S2gAZZSLuLZ1qMXr1dEnO8AwxS58UvKGwHObT1XQG8WT3Q1/6OGlJms4mYY1rF\nQXzYEV5w0RlcSrMpLz3+nJ7cVb9lYKOO8hHZFWudFRywkYb/aeNh6mAXqrulv92z\noX0S7YMeNd2YrhqefQIDAQAB\n-----END PUBLIC KEY-----",
            //    "pubkey2":"Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
            //    "last_request_at":1503051957877,
            //    "done":{"1503051957877":1503051958520},
            //    "url":"/1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1"};
            // url and pubkey - should be a 1-1 relation. many pubkey => use last session and delete old session

            for (sessionid in ls_sessions) {
                session_info = ls_sessions[sessionid][SESSION_INFO_KEY] ;
                if (!session_info) continue ;
                // initialize encrypt object. added to sessions in MoneyNetworkAPILib. incoming message from old sessions will be processed by "process_incoming_message"
                console.log(pgm + 'create session with sessionid ' + sessionid + '. session_info = ' + JSON.stringify(session_info)) ;
                try {
                    encrypt = new MoneyNetworkAPI({
                        sessionid: sessionid,
                        pubkey: session_info.pubkey,
                        pubkey2: session_info.pubkey2,
                        debug: true
                    }) ;
                }
                catch (e) {
                    console.log(pgm + 'error. could not create a session with sessionid ' + sessionid + '. error = ' + (e.message || 'see previous message in log')) ;
                }
            } // for sessionid

            // check sessions. incoming files. compare list of done files in ls_sessions with incoming files on file system (dbQuery)
            MoneyNetworkAPILib.get_sessions(function (sessions1) {
                var sessions2, sessions3, i, step_1_find_incoming_files, step_2_cleanup_ls_done_files, step_3_find_old_outgoing_files ;
                sessions2 = {} ; // from other_session_filename to hash with not deleted files (incoming files from other session)
                sessions3 = {} ; // from sessionid to hash with not deleted files (incoming files from other session)

                console.log(pgm + 'sessions1 = ' + JSON.stringify(sessions1)) ;
                //sessions1 = [
                //    {
                //        "other_session_filename": "1530742720",
                //        "sessionid": "z1a4wzejn0bifkglpblefqqedevpdiyissdstq5kbppardmbzdytbtrzkp2w",
                //        "session_at": 1505663493707,
                //        "this_session_filename": "ddbb4f18a7"
                //    },
                //    ...
                //    {
                //        "other_session_filename": "16276a26dc",
                //        "sessionid": "wslrlc5iomh45byjnblebpvnwheluzzdhqlqwvyud9mu8dtitus3kjsmitc1",
                //        "session_at": 1505663493709,
                //        "this_session_filename": "3f6561327a"
                //    }
                //];

                // My cert_user_id is jro@zeroid.bit, my auth address is 18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ,
                // my unique id be4e96172fe3a8cafdf30057a8e8f4409c7b538383b3d7e1b3c35603eaa076d5 and my user data hub is1PgyTnnACGd1XRdpfiDihgKwYRRnzgz2zh

                // reformat sessions1 array
                for (i=0 ; i<sessions1.length ; i++) {
                    sessions2[sessions1[i].other_session_filename] = {sessionid: sessions1[i].sessionid, files: {}}
                }
                console.log(pgm + 'sessions2 = ' + JSON.stringify(sessions2)) ;

                // callback chain step 1-3

                // find old outgoing files. delete old outgoing files except offline transactions
                step_3_find_old_outgoing_files = function(){
                    var pgm = service + '.create_sessions.step_3_find_old_outgoing_files: ';
                    get_my_user_hub(function (hub) {
                        var pgm = service + '.create_sessions.step_3_find_old_outgoing_files get_my_user_hub callback 1: ';
                        var query1;

                        // query 1. simple get all optional files for current user directory
                        // todo: optional files and actual files on file system can be out of sync. Should delete files_optional + sign to be sure that optional files and file system matches
                        query1 =
                            "select files_optional.filename from json, files_optional " +
                            "where directory like '" + hub + "/data/users/" + ZeroFrame.site_info.auth_address + "' " +
                            "and file_name = 'content.json' " +
                            "and files_optional.json_id = json.json_id";
                        console.log(pgm + 'query1 = ' + query1);
                        console.log(pgm + 'todo: add debug_seq to this query');

                        ZeroFrame.cmd("dbQuery", [query1], function (res) {
                            var pgm = service + '.create_sessions.step_3_find_old_outgoing_files dbQuery callback 2: ';
                            var files1, i, re, files2, filename, this_session_filename, timestamp, session_info,
                                sessionid, session_at ;
                            if (res.error) {
                                console.log(pgm + 'query failed. error = ' + res.error);
                                console.log(pgm + 'query = ' + query1);
                                return;
                            }
                            // console.log(pgm + 'res = ' + JSON.stringify(res)) ;

                            // map from valid this_session_filename to session_info and list with any offline transactions
                            session_at = {} ;
                            session_info = {} ;
                            for (i=0 ; i<sessions1.length ; i++) {
                                this_session_filename = sessions1[i].this_session_filename ;
                                sessionid = sessions1[i].sessionid ;
                                if (!ls_sessions[sessionid]) continue ; // error
                                session_at[this_session_filename] = sessions1[i].session_at ;
                                session_info[this_session_filename] = ls_sessions[sessionid][SESSION_INFO_KEY] ;
                            } // i
                            console.log(pgm + 'session_at = ' + JSON.stringify(session_at)) ;
                            //session_at = {"ddbb4f18a7":1505752737688,"825c05a018":1505752737681,"3af9a70f1f":1505752737683,"02db2101c5":1505752737685,"3f6561327a":1505752737691};

                            console.log(pgm + 'session_info = ' + JSON.stringify(session_info)) ;
                            //session_info = {
                            //    "ddbb4f18a7": {
                            //        "password": "U2FsdGVkX1+6+X4pSDQOf8/Bb+3xG+nFQDyhr3/7syi+wYXKEZ6UL49dB2ftq1gmC5/LKfI2XfJS2fEsEy5CYscRBDuoUxJEqKNwiiiiXBA=",
                            //        "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCsOMfAvHPTp0K9qZfoItdJ9898\nU3S2gAZZSLuLZ1qMXr1dEnO8AwxS58UvKGwHObT1XQG8WT3Q1/6OGlJms4mYY1rF\nQXzYEV5w0RlcSrMpLz3+nJ7cVb9lYKOO8hHZFWudFRywkYb/aeNh6mAXqrulv92z\noX0S7YMeNd2YrhqefQIDAQAB\n-----END PUBLIC KEY-----",
                            //        "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                            //        "last_request_at": 1503137602267,
                            //        "done": {},
                            //        "url": "/1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1"
                            //    },
                            //    "825c05a018": {
                            //        "password": "U2FsdGVkX18YSwwUOLQS9lMqivpF7ynNzNXBuOOFvy91i/JApuPUiFRH4ViMQvezXD6tS+4AXZYZJd7f98EeW4V74+RvcfjHg2VFmUQvS4U=",
                            //        "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgHzoMPSwwM8z1P7eZzjNFe7Md6Ds\nkMhR0DlUvTlJOtxfZ/KENMsBIl45pize7sGJxpAmIJQG1JQzOp9R0qFW22geoK5q\nbn8WGHNHRyRObjpqDpRkwiovCz5DtP0AFvliawhFj60WEV56gL5sFoJ0/154MbZZ\nt2nA0/i76YJLfZHxAgMBAAE=\n-----END PUBLIC KEY-----",
                            //        "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                            //        "last_request_at": 1501605913768,
                            //        "done": {}
                            //    },
                            //    "3af9a70f1f": {
                            //        "password": "U2FsdGVkX1/5ItpxUyRH1ZiZuoyN1tCvLUKpSogDnVDvBNLcODVLijUC52N8WBSYf3hBxXzQZYjkRqKdk79oS5Rp/nJ3rq9bSgoodVJPxyU=",
                            //        "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgHsgCP4qEflm0HEXYUO5dP+UOENN\n7C5K8H7aFVmhwc32PwySbLcdQDbWpFhX6cKODQOC5gJNSnzoEHqxrNeCO97yXe/P\nyzVVjHlq56a16IC2lB/SSnUh5ipjfC4grFK9ZlMUpHUDN/j5oxzUnK/QLd5L1wLO\nsITFawX1WuxB9FERAgMBAAE=\n-----END PUBLIC KEY-----",
                            //        "pubkey2": "AjNp+TH4ho3DEmyfa73v447KWgv/W8t3R94/mY+ib/2+",
                            //        "last_request_at": 1501597939326,
                            //        "done": {}
                            //    },
                            //    "02db2101c5": {
                            //        "password": "U2FsdGVkX18+bh2RYZzvbeLoCqsGvj12eTfL7T/3frFfO9VQbgLpGAEsO+5QZjH3JrRr9wmGjIe+O6SojshHm8XdgZvYV19msuyWh+HX0XE=",
                            //        "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDjZGACcz2Swp07gN7+use66NvA\nIAxvMpykW7qcG3MP2DTDH3mKg1JlY40U4SwP5CE1LGmOJN7Saymoh2W9i0oHzxvR\n+b+bNcoG09eYZuinH1M7FB9wx8RxcfbNH+lzoAtU4HVnGrtrLG5X2SM9Cx+FN9cw\ncdVCdwU1IqwILPyDCwIDAQAB\n-----END PUBLIC KEY-----",
                            //        "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                            //        "last_request_at": 1503050724533,
                            //        "done": {}
                            //    },
                            //    "3f6561327a": {
                            //        "url": "/1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                            //        "password": "U2FsdGVkX18MyosYqdGVowB1nw/7Nm2nbzATu3TexEXMig7rjInIIr13a/w4G5TzFLFz9GE+rqGZsqRP+Ms0Ez3w8cA9xNhPjtrhOaOkT1M=",
                            //        "pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCuM/Sevlo2UYUkTVteBnnUWpsd\n5JjAUnYhP0M2o36da15z192iNOmd26C+UMg0U8hitK8pOJOLiWi8x6TjvnaipDjc\nIi0p0l3vGBEOvIyNEYE7AdfGqW8eEDzzl9Cezi1ARKn7gq1o8Uk4U2fjkm811GTM\n/1N9IwACfz3lGdAm4QIDAQAB\n-----END PUBLIC KEY-----",
                            //        "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                            //        "last_request_at": 1505751791641,
                            //        "done": {
                            //            "1503315223138": 1503315232562,
                            //            "1503916247431": 1503916247859,
                            //            "1504261657652": 1504261664116,
                            //            "1504261977720": 1504261982693,
                            //            "1505477436154": 1505477443260,
                            //            "1505484214619": 1505484217007,
                            //            "1505484840492": 1505484842795,
                            //            "1505485442061": 1505485444720,
                            //            "1505485933357": 1505485934580,
                            //            "1505487060777": 1505487062463,
                            //            "1505489780265": 1505489782366,
                            //            "1505550671820": 1505550725534,
                            //            "1505576551260": 1505576552166
                            //        },
                            //        "balance": [{"code": "tBTC", "amount": 1.3}],
                            //        "balance_at": 1504431366592,
                            //        "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74"
                            //    }
                            //};

                            re = new RegExp('^[0-9a-f]{10}.[0-9]{13}$'); // no user seq (MoneyNetworkAPI messages)
                            files1 = [] ;
                            for (i=0 ; i<res.length ; i++) if (res[i].filename.match(re)) files1.push(res[i].filename) ;
                            console.log(pgm + 'files1 = ' + JSON.stringify(files1)) ;
                            //files1 = ["3f6561327a.1474665067076", "3f6561327a.1472282567643", "3f6561327a.1475706471612", "3f6561327a.1475685146639", "3f6561327a.1472197202640", "3f6561327a.1471393354195", "3f6561327a.1475916076111", "3f6561327a.1473627685854", "3f6561327a.1475251057063", "3f6561327a.1472104626705", "3f6561327a.1471831583539", "3f6561327a.1474478812729", "3f6561327a.1474804539180", "3f6561327a.1476205886263", "3f6561327a.1473249405340", "3f6561327a.1472026664343", "3f6561327a.1476424181413", "3f6561327a.1471564536590", "3f6561327a.1473646753222", "3f6561327a.1471917524352", "3f6561327a.1471976592878", "3f6561327a.1474745414662", "3f6561327a.1476135581171", "3f6561327a.1474122722696", "3f6561327a.1476073867217", "3f6561327a.1473167872165", "3f6561327a.1476559711025", "3f6561327a.1472449416593", "3f6561327a.1473033703401", "3f6561327a.1475796712277", "3f6561327a.1471856461133", "3f6561327a.1473010786666", "3f6561327a.1474654532839", "3f6561327a.1474248258663", "3f6561327a.1471503749260", "3f6561327a.1471976734587", "3f6561327a.1475238729722", "3f6561327a.1473441766500", "3f6561327a.1473785926028", "3f6561327a.1476013919996", "3f6561327a.1472925485650", "3f6561327a.1473709828898", "3f6561327a.1473449375291", "3f6561327a.1474056537691", "3f6561327a.1471712354236", "3f6561327a.1473731777757", "3f6561327a.1475378942077", "3f6561327a.1473523004275", "3f6561327a.1474437441649", "3f6561327a.1475932891045", "3f6561327a.1476185082949", "3f6561327a.1476240602333", "3f6561327a.1472395916104", "3f6561327a.1473306586555"];

                            // group files by <this_session_filename>. special 0000000000000 file is used for offline transactions.
                            files2 = {} ;
                            for (i=0 ; i<files1.length ; i++) {
                                filename = files1[i] ;
                                this_session_filename = filename.substr(0,10) ;
                                timestamp = parseInt(filename.substr(11)) ;
                                if (timestamp == 0) continue ;
                                if (!files2[this_session_filename]) files2[this_session_filename] = [] ;
                                files2[this_session_filename].push(timestamp) ;
                            } // i
                            console.log(pgm + 'files2 = ' + JSON.stringify(files2)) ;
                            //files2 = { "3f6561327a": [1474665067076, 1472282567643, 1475706471612, 1475685146639, 1472197202640, 1471393354195, 1475916076111, 1473627685854, 1475251057063, 1472104626705, 1471831583539, 1474478812729, 1474804539180, 1476205886263, 1473249405340, 1472026664343, 1476424181413, 1471564536590, 1473646753222, 1471917524352, 1471976592878, 1474745414662, 1476135581171, 1474122722696, 1476073867217, 1473167872165, 1476559711025, 1472449416593, 1473033703401, 1475796712277, 1471856461133, 1473010786666, 1474654532839, 1474248258663, 1471503749260, 1471976734587, 1475238729722, 1473441766500, 1473785926028, 1476013919996, 1472925485650, 1473709828898, 1473449375291, 1474056537691, 1471712354236, 1473731777757, 1475378942077, 1473523004275, 1474437441649, 1475932891045, 1476185082949, 1476240602333, 1472395916104, 1473306586555]};

                            // delete all optional files with unknown this_session_filename or with timestamp < session_at
                            // exception: keep offline transactions with timestamp < session_at

                        }); // dbQuery callback 2

                    }) ; // get_my_user_hub callback 1

                } ; // step_3_find_old_outgoing_files

                // step 2: cleanup done lists in ls_sessions
                step_2_cleanup_ls_done_files = function() {
                    var pgm = service + '.create_sessions.step_2_cleanup_ls_done_files: ';
                    var other_session_filename, sessionid, timestamp, session_info, delete_timestamps, no_done_deleted ;
                    // console.log(pgm + 'ls_sessions = ' + JSON.stringify(ls_sessions)) ;
                    // console.log(pgm + 'sessions2 = ' + JSON.stringify(sessions2)) ;
                    for (other_session_filename in sessions2) {
                        sessionid = sessions2[other_session_filename].sessionid ;
                        sessions3[sessionid] = {} ;
                        for (timestamp in sessions2[other_session_filename].files) {
                            sessions3[sessionid][timestamp] = sessions2[other_session_filename].files[timestamp]
                        }
                    }
                    // console.log(pgm + 'sessions3 = ' + JSON.stringify(sessions3)) ;

                    // check done files for each session in ls_sessions
                    no_done_deleted = 0 ;
                    for (sessionid in ls_sessions) {
                        session_info = ls_sessions[sessionid][SESSION_INFO_KEY] ;
                        if (!session_info) continue ;
                        if (!session_info.done) continue ;
                        delete_timestamps = [] ;
                        for (timestamp in session_info.done) {
                            if (!sessions3[sessionid][timestamp]) {
                                // file in done list and has been deleted by other session. remove from done list
                                delete_timestamps.push(timestamp) ;
                            }
                        }
                        // remove from done list
                        while (delete_timestamps.length) {
                            timestamp = delete_timestamps.shift() ;
                            delete session_info.done[timestamp] ;
                            no_done_deleted++ ;
                        }
                    } // for sessionid
                    console.log(pgm + 'no_done_deleted = ' + no_done_deleted) ;
                    // no deleted = 64
                    // no deleted = 0
                    if (no_done_deleted) ls_save_sessions() ;
                    // next step
                    step_3_find_old_outgoing_files() ;
                }; // step_2_cleanup_ls_done_files

                // step 1: dbQuery - find incoming not deleted messages
                step_1_find_incoming_files = function () {
                    var pgm = service + '.create_sessions.step_1_find_incoming_files: ';
                    var query, first, other_session_filename  ;
                    if (!Object.keys(sessions2).length) return ; // no sessions
                    console.log(pgm + 'sessions2 = ' + JSON.stringify(sessions2)) ;

                    // build query
                    first = true;
                    query =
                        "select json.directory, files_optional.filename " +
                        "from files_optional, json " +
                        "where ";
                    for (other_session_filename in sessions2) {
                        query += first ? "(" : " or ";
                        query += "files_optional.filename like '" + other_session_filename + ".%'";
                        first = false ;
                    }
                    query +=
                        ") and json.json_id = files_optional.json_id " +
                        "order by substr(files_optional.filename, 12)";
                    console.log(pgm + 'query = ' + query) ;
                    console.log(pgm + 'todo: add debug_seq to this query') ;

                    ZeroFrame.cmd("dbQuery", [query], function (res) {
                        var pgm = service + '.create_sessions.step_1_find_incoming_files dbQuery callback: ';
                        var i, filename, timestamp, timestamp_re, other_session_filename ;
                        if (res.error) {
                            console.log(pgm + 'query failed. error = ' + res.error);
                            console.log(pgm + 'query = ' + query);
                            return;
                        }
                        // console.log(pgm + 'res = ' + JSON.stringify(res));
                        //res = [{
                        //    "directory": "1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ",
                        //    "filename": "3c69e1b778.1500291521896"
                        //}, {
                        // ...
                        //}, {
                        //    "directory": "1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ",
                        //    "filename": "90ed57c290.1500649849934"
                        //}];
                        timestamp_re = /^[0-9]{13}$/ ;
                        for (i=0 ; i<res.length ; i++) {
                            filename = res[i].filename;
                            other_session_filename = filename.substr(0,10) ;
                            timestamp = filename.substr(11) ;
                            if (!timestamp.match(timestamp_re)) continue ;
                            timestamp = parseInt(timestamp) ;
                            sessions2[other_session_filename].files[timestamp] = true ;
                        } // for i
                        //console.log(pgm + 'sessions2 = ' + JSON.stringify(sessions2)) ;

                        // next step
                        step_2_cleanup_ls_done_files() ;

                    }) ; // dbQuery callback

                }; // step_1_find_files

                // start callback chain step 1-2
                step_1_find_incoming_files() ;

            }) ; // get_sessions callback

        } // create_sessions

        // generic callback function to handle incoming messages from wallet session(s):
        // - save_data message. save (encrypted) data in MoneyNetwork localStorage
        // - get_data message. return (encrypted) data saved in MoneyNetwork localStorage
        // - delete_data message. delete data saved in MoneyNetwork localStorage
        console.log(service + ': todo: add done callback. demon process should wait until processing next message');

        function process_incoming_message (filename, encrypt2) {
            var pgm = service + '.process_incoming_message: ' ;
            var debug_seq, pos, other_user_path, sessionid, session_info, file_timestamp ;


            try {
                if (detected_client_log_out(pgm)) return ;
                if (encrypt2.destroyed) {
                    // MoneyNetworkAPI instance has been destroyed. Maybe deleted session. Maybe too many invalid get_password requests?
                    console.log(pgm + 'ignoring incoming message ' + filename + '. session has been destroyed. reason = ' + encrypt2.destroyed) ;
                    return ;
                }
                console.log(pgm + 'filename = ' + filename) ;
                // filename = merged-MoneyNetwork/1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ/0d4002d16c.1499860158848

                // check other_user_path. all messages for this session must come from same user directory
                pos = filename.lastIndexOf('/') ;
                other_user_path = filename.substr(0,pos+1) ;
                // console.log(pgm + 'other_user_path = ' + other_user_path) ;
                encrypt2.setup_encryption({other_user_path: other_user_path}) ; // set and check

                // get session info. ignore already read messages
                sessionid = encrypt2.sessionid ;
                session_info = ls_sessions[sessionid] ? ls_sessions[sessionid][SESSION_INFO_KEY] : null ;
                pos = filename.lastIndexOf('.') ;
                file_timestamp = parseInt(filename.substr(pos+1)) ;
                console.log(pgm + 'file_timestamp = ' + file_timestamp) ;

                if (session_info) {
                    if (!session_info.hasOwnProperty('done')) session_info.done = {} ;
                    if (session_info.done[file_timestamp]) {
                        console.log(pgm + 'ignoring incoming message ' + filename + '. already received');
                        return;
                    }
                }

                debug_seq = MoneyNetworkHelper.debug_z_api_operation_start('z_file_get', pgm + filename + ' fileGet') ;
                ZeroFrame.cmd("fileGet", {inner_path: filename, required: false}, function (json_str) {
                    var pgm = service + '.process_incoming_message fileGet callback 1: ';
                    var encrypted_json;
                    MoneyNetworkHelper.debug_z_api_operation_end(debug_seq);
                    if (!json_str) {
                        // OK. other session has deleted this message. normally deleted after a short time
                        if (session_info) session_info.done[file_timestamp] = true ;
                        ls_save_sessions() ;
                        return ;
                    }
                    // console.log(pgm + 'this_session_userid2 = ' + encrypt2.this_session_userid2) ;
                    encrypted_json = JSON.parse(json_str) ;
                    encrypt2.decrypt_json(encrypted_json, function (request) {
                        var pgm = service + '.process_incoming_message decrypt_json callback 2: ';
                        var response_timestamp, request_timestamp, error, response, i, key, value, encryptions, done_and_send ;
                        // console.log(pgm + 'request = ' + JSON.stringify(request)) ;
                        encryptions = [1,2,3] ;

                        // remove any response timestamp before validation (used in response filename)
                        response_timestamp = request.response ; delete request.response ; // request received. must use response_timestamp in response filename
                        request_timestamp = request.request ; delete request.request ; // response received. todo: must be a response to previous send request with request timestamp in request filename

                        done_and_send = function (response, encryptions) {
                            // marked as done. do not process same message twice
                            var now ;
                            now = new Date().getTime() ;
                            if (session_info) {
                                session_info.done[file_timestamp] = now ;
                                if (!response.error || ['pubkeys','get_password'].indexOf(request.msgtype) == -1) {
                                    // update last_request_at timestamp (exceptions are invalid pubkeys and get_password messages)
                                    if (!session_info.last_request_at || (file_timestamp > session_info.last_request_at)) session_info.last_request_at = file_timestamp ;
                                }
                            }
                            ls_save_sessions() ;
                            console.log(pgm + 'request = ' + JSON.stringify(request)) ;
                            console.log(pgm + 'timestamps: file_timestamp = ' + file_timestamp + ', response_timestamp = ' + response_timestamp + ', request_timestamp = ' + request_timestamp + ', now = ' + now) ;
                            console.log(pgm + 'session_info = ' + JSON.stringify(session_info)) ;
                            if (response_timestamp) {
                                // response was requested
                                console.log(pgm + 'response = ' + JSON.stringify(response)) ;
                                console.log(pgm + 'encryptions = ' + JSON.stringify(encryptions)) ;
                            }
                            else return ; // exit. no response was requested

                            // send response to other session
                            encrypt2.send_message(response, {timestamp: response_timestamp, msgtype: request.msgtype, request: file_timestamp, encryptions: encryptions}, function (res)  {
                                var pgm = service + '.process_incoming_message send_message callback 3: ';
                                console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            }) ; // send_message callback 3

                        } ; // done_and_send

                        // validate and process incoming json message and process
                        response = { msgtype: 'response' } ;
                        error = MoneyNetworkAPILib.validate_json(pgm, request) ;
                        if (error) response.error = 'message is invalid. ' + error ;
                        else if (request.msgtype == 'pubkeys') {
                            // first message from wallet. received public keys from wallet session
                            if (!request.password) response.error = 'Password is required in pubkeys message from wallet' ;
                            else if (session_info) response.error = 'Public keys have already been received. Keeping old session information' ;
                            else if (!encrypt2.extra && encrypt2.extra.url) response.error = 'No site url was found for this session' ;
                            else {
                                encrypt2.setup_encryption({pubkey: request.pubkey, pubkey2: request.pubkey2}) ;
                                console.log(pgm + 'saving session password. used for wallet session restore. See get_password and password messages');
                                // console.log(pgm + 'setting last_request_at: encrypt2.session_at = ' + encrypt2.session_at + ', file_timestamp = ' + file_timestamp);
                                session_info = {
                                    url: encrypt2.extra.url,
                                    password: request.password, // encrypted session password pwd2
                                    pubkey: encrypt2.other_session_pubkey,
                                    pubkey2: encrypt2.other_session_pubkey2,
                                    last_request_at: file_timestamp,
                                    done: {}
                                } ;
                                if (!ls_sessions[sessionid]) ls_sessions[sessionid] = {} ;
                                ls_sessions[sessionid][SESSION_INFO_KEY] = session_info ;
                            }
                        }
                        else if (request.msgtype == 'save_data') {
                            // received data_data request from wallet session.
                            console.log(pgm + 'save wallet data in MN localStorage') ;
                            if (!ls_sessions[sessionid]) ls_sessions[sessionid] = {} ;
                            for (i=0 ; i<request.data.length ; i++) {
                                key = request.data[i].key ;
                                if (key == SESSION_INFO_KEY) continue ;
                                value = request.data[i].value ;
                                ls_sessions[sessionid][key] = value ;
                            }
                        }
                        else if (request.msgtype == 'delete_data') {
                            // received delete_data request from wallet session.
                            console.log(pgm + 'delete wallet data saved in MN localStorage') ;
                            if (!ls_sessions[sessionid]) null ; // OK - no data
                            else if (!request.keys) {
                                // OK - no keys array - delete all data
                                for (key in ls_sessions[sessionid]) {
                                    if (key == SESSION_INFO_KEY) continue ;
                                    delete ls_sessions[sessionid][key] ;
                                }
                            }
                            else {
                                // keys array. deleted requested keys
                                for (i=0 ; i<request.keys.length ; i++) {
                                    key = request.keys[i].key ;
                                    if (key == SESSION_INFO_KEY) continue ;
                                    delete ls_sessions[sessionid][key] ;
                                }
                            }
                        }
                        else if (request.msgtype == 'get_data') {
                            // received get_data request from wallet session. return data response
                            response = { msgtype: 'data', data: []} ;
                            if (ls_sessions[sessionid]) {
                                for (i=0 ; i<request.keys.length ; i++) {
                                    key = request.keys[i] ;
                                    if (key == SESSION_INFO_KEY) continue ; // special key used for session restore
                                    if (!ls_sessions[sessionid]) continue ; // OK - no data - return empty data array
                                    if (!ls_sessions[sessionid].hasOwnProperty(key)) continue ; // OK - no data with this key
                                    value = ls_sessions[sessionid][key] ;
                                    response.data.push({key: key, value: value}) ;
                                } // for i
                            }
                        }
                        else if (request.msgtype == 'get_password') {
                            // received get_password request from wallet session. return password if OK. Encrypt response with cryptMessage only
                            // console.log(pgm + 'request = ' + JSON.stringify(request)) ;
                            // get unlock_pwd2
                            encrypt2.get_session_filenames(function (this_session_filename, other_session_filename, unlock_pwd2) {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + ' get_session_filenames callback: ';
                                encryptions = [2] ; // only cryptMessage. Wallet session JSEncrypt prvkey is not yet restored from localStorage
                                if (session_info.invalid_get_password &&
                                    (session_info.invalid_get_password > 6)) {
                                    session_info = null ;
                                    delete ls_sessions[sessionid] ;
                                    encrypt2.destroy('Too many invalid get_password errors') ;
                                }
                                if (!ls_sessions[sessionid]) response.error = 'Session has been deleted' ;
                                else if (!session_info) response.error = 'Session info was not found' ;
                                else if (session_info.invalid_get_password && (session_info.invalid_get_password > 3)) response.error = 'Too many get_password errors' ;
                                else if (encrypt2.other_session_pubkey != request.pubkey) response.error = 'Not found pubkey' ;
                                else if (encrypt2.other_session_pubkey2 != request.pubkey2) response.error = 'Not found pubkey2' ;
                                else if (encrypt2.unlock_pwd2 != request.unlock_pwd2) response.error = 'Not found unlock_pwd2' ;
                                else {
                                    response = {
                                        msgtype: 'password',
                                        password: session_info.password
                                    }
                                }
                                // count no get_password errors. max 3
                                if (session_info) {
                                    if (response.error) {
                                        if (!session_info.invalid_get_password) session_info.invalid_get_password = 0 ;
                                        session_info.invalid_get_password++ ;
                                    }
                                    else if (session_info.invalid_get_password) {
                                        delete session_info.invalid_get_password ;
                                    }
                                }
                                // finish message processing. marked as done and send any response
                                done_and_send(response, encryptions) ;

                            }) ; // get_session_filenames callback
                            // stop and wait
                            return ;

                        }
                        else if (request.msgtype == 'ping') {
                            // simple session ping. always OK response
                        }
                        else if (request.msgtype == 'balance') {
                            // received balance message from wallet. save + OK response
                            session_info.balance = request.balance ;
                            session_info.balance_at = new Date().getTime() ;
                            ls_save_sessions() ;
                        }
                        else if (request.msgtype == 'notification') {
                            // received at notification from a wallet session. just display
                            // adding wallet_title to notification') ;
                            MoneyNetworkAPILib.get_wallet_info(session_info.wallet_sha256, function (wallet_info, delayed) {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + ' get_wallet_info callback: ';
                                var message ;
                                if (!wallet_info || wallet_info.error || !wallet_info[session_info.wallet_sha256]) {
                                    response.error = 'could not find wallet information for wallet_sha256 ' + session_info.wallet_sha256 + '. wallet_info = ' + JSON.stringify(wallet_info) ;
                                    console.log(pgm + response.error) ;
                                    console.log(pgm + 'ignoring notification = ' + JSON.stringify(request)) ;
                                    // normally no wait for response for notification messages
                                    return done_and_send(response, encryptions) ;
                                }
                                message = $sanitize(wallet_info[session_info.wallet_sha256].wallet_title) + ':<br>' + $sanitize(request.message) ;
                                ZeroFrame.cmd("wrapperNotification", [request.type, message, request.timeout]) ;

                            }) ;
                            return ;
                        }
                        else response.error = 'Unknown msgtype ' + request.msgtype ;

                        // finish message processing. marked as done and send any response
                        done_and_send(response, encryptions) ;

                    }) ; // decrypt_json callback 2
                }) ; // fileGet callback 1

            } // try
            catch (e) {
                console.log(pgm + e.message) ;
                console.log(e.stack);
                throw(e) ;
            } // catch

        } // process_incoming_message

        // add callback for incoming messages from wallet session(s)
        MoneyNetworkAPILib.config({cb: process_incoming_message}) ;

        // init wallet service after client log in
        function w_login () {
            var pgm = service + '.w_login: ' ;
            console.log(pgm + 'getting sessions ...') ;
            ls_sessions = ls_get_sessions() ; // sessionid => hash with saved wallet data
            //console.log(pgm + 'ls_sessions = ' + JSON.stringify(ls_sessions)) ;

            get_my_user_hub(function (hub) {
                var user_path ;
                user_path = 'merged-MoneyNetwork/' + hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/';
                MoneyNetworkAPILib.config({this_user_path: user_path});
                // setup session instances and listen for incoming messages
                create_sessions() ;
            }) ;
        } // w_login

        // reset wallet service after client log out
        function w_logout () {
            ls_sessions = null ;
            MoneyNetworkAPILib.delete_all_sessions() ;
        }

        // return list with currencies. currencies array is used in angularJS UI (minimum updates)
        var currencies = [] ;
        function get_currencies (cb) {
            var pgm = service + '.get_currencies: ' ;
            var temp_currencies, wallet_sha256_values, sessionid, session_info, i, balance ;
            if (!ls_sessions) return [] ; // error?
            temp_currencies = [] ;
            wallet_sha256_values = [] ;
            for (sessionid in ls_sessions) {
                session_info = ls_sessions[sessionid][SESSION_INFO_KEY];
                if (!session_info) continue;
                //if (!session_info.currencies) continue;
                if (!session_info.balance) continue;
                // console.log(pgm + 'session_info = ' + JSON.stringify(session_info)) ;
                for (i=0 ; i<session_info.balance.length ; i++) {
                    balance = JSON.parse(JSON.stringify(session_info.balance[i])) ;
                    balance.balance_at = session_info.balance_at ;
                    balance.sessionid = sessionid ;
                    balance.wallet_sha256 = session_info.wallet_sha256 ;
                    temp_currencies.push(balance) ;
                    wallet_sha256_values.push(session_info.wallet_sha256) ;
                } // for i
            }
            if (!temp_currencies.length) {
                // no wallet / no balance info was found
                while (currencies.length) currencies.shift() ;
                return cb(currencies, false) ;
            }

            // find full wallet info from sha256 values
            console.log(pgm + 'wallet_sha256_values = ' + JSON.stringify(wallet_sha256_values)) ;

            // todo: better param name (delayed)

            MoneyNetworkAPILib.get_wallet_info(wallet_sha256_values, function (wallet_info, delayed) {
                var wallet_sha256, i, key, balance, j, k, currency, unique_id, unique_ids, old_row, new_row, unique_texts ;
                // console.log(pgm + 'wallet_info = ' + JSON.stringify(wallet_info)) ;
                //wallet_info = {
                //    "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74": {
                //        "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                //        "wallet_title": "MoneyNetworkW2",
                //        "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro",
                //        "currencies": [{
                //            "code": "tBTC",
                //            "name": "Test Bitcoin",
                //            "url": "https://en.bitcoin.it/wiki/Testnet",
                //            "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}]
                //        }],
                //        "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74"
                //    }
                //};
                if (!wallet_info || (typeof wallet_info != 'object') || wallet_info.error) {
                    console.log(pgm + 'could not find wallet_info for sha256 values ' + JSON.stringify(wallet_sha256_values) + '. wallet_info = ' + JSON.stringify(wallet_info)) ;
                }
                else for (wallet_sha256 in wallet_info) {
                    for (i=0 ; i<temp_currencies.length ; i++) {
                        if (wallet_sha256 != temp_currencies[i].wallet_sha256) continue ;
                        // copy wallet info to currency (wallet_address, wallet_title, wallet_description and currencies
                        for (key in wallet_info[wallet_sha256]) {
                            temp_currencies[i][key] = wallet_info[wallet_sha256][key] ;
                        } // for key
                        break ; // break currencies loop. next sha256 value
                    } // for i
                } // for wallet_sha256

                // copy full wallet info into currencies array
                for (i=temp_currencies.length-1 ; i >= 0 ; i--) {
                    if (temp_currencies[i].wallet_address) continue ;
                    console.log(pgm + 'removing currency/balance info with unknown wallet_sha256. ' + JSON.stringify(temp_currencies[i])) ;
                    temp_currencies.splice(i,1) ;
                }
                console.log(pgm + 'sessions (after get_currencies) = ' + JSON.stringify(ls_sessions)) ;

                // move currency info (name, url and units) to currency rows for easy filter and sort
                unique_texts = {} ;
                for (i=temp_currencies.length-1 ; i>=0 ; i--) {
                    balance = temp_currencies[i] ;
                    if (!balance.currencies || !balance.currencies.length) {
                        console.log(pgm + 'no currencies array was found in ' + JSON.stringify(balance)) ;
                        temp_currencies.splice(i,1) ;
                        continue ;
                    }
                    j = -1 ;
                    for (k=0 ; k<balance.currencies.length ; k++) {
                        if (balance.currencies[k].code != balance.code) continue ;
                        j = k ;
                        break ;
                    } // for k
                    if (j == -1) {
                        console.log(pgm + 'error in balance. Currency code ' + balance.code + ' was not found. balance = ' + JSON.stringify(balance)) ;
                        temp_currencies.splice(i,1) ;
                        continue ;
                    }
                    // merge balance and currency information
                    balance.unique_id = balance.wallet_sha256 + '/' + balance.code ;
                    //currencies = [{
                    //    "code": "tBTC",
                    //    "amount": 1.3,
                    //    "balance_at": 1504265571720,
                    //    "sessionid": "wslrlc5iomh45byjnblebpvnwheluzzdhqlqwvyud9mu8dtitus3kjsmitc1",
                    //    "wallet_sha256": "6ef0247021e81ae7ae1867a685f0e84cdb8a61838dc25656c4ee94e4f20acb74",
                    //    "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                    //    "wallet_title": "MoneyNetworkW2",
                    //    "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro",
                    //    "name": "Test Bitcoin",
                    //    "url": "https://en.bitcoin.it/wiki/Testnet",
                    //    "units": [{"unit": "BitCoin", "factor": 1}, {"unit": "Satoshi", "factor": 1e-8}]
                    //}];

                    currency = balance.currencies[j] ;
                    for (key in currency) {
                        if (!currency.hasOwnProperty(key)) continue ;
                        balance[key] = currency[key] ;
                    }
                    balance.unique_text = balance.code + ' ' + balance.name + ' from ' + balance.wallet_title;
                    if (!unique_texts[balance.unique_text]) unique_texts[balance.unique_text] = 0 ;
                    unique_texts[balance.unique_text]++ ;
                    delete balance.currencies ;
                } // for i

                console.log(pgm + 'force unique_text. wallet_title may not be unique') ;
                for (i=0 ; i<temp_currencies.length ; i++) {
                    balance = temp_currencies[i] ;
                    if (unique_texts[balance.unique_text] == 1) continue ; // OK
                    balance.unique_text = balance.code + ' ' + balance.name + ' from ' + balance.wallet_address;
                } // for i

                // merge new currencies array into old currencies array (insert, update, delete). used in angularJS UI
                unique_ids = {} ;
                for (i=0 ; i<currencies.length ; i++) unique_ids[currencies[i].unique_id] = { in_old: currencies[i]} ;
                for (i=0 ; i<temp_currencies.length ; i++) {
                    unique_id = temp_currencies[i].unique_id ;
                    if (!unique_ids[unique_id]) unique_ids[unique_id] = {} ;
                    unique_ids[unique_id].in_new = i ; // index for insert and update operation
                } // for i
                // delete
                for (i=currencies.length-1 ; i>=0 ; i--) {
                    unique_id = currencies[i].unique_id ;
                    if (unique_ids[unique_id].hasOwnProperty('in_new')) continue ;
                    currencies.splice(i,1) ;
                }
                // insert or update
                for (unique_id in unique_ids) {
                    if (unique_ids[unique_id].in_old) {
                        // in old
                        if (unique_ids[unique_id].hasOwnProperty('in_new')) {
                            // in old and in new. update info. most info is readonly. only amount and balance_at can change
                            old_row = unique_ids[unique_id].in_old ;
                            i = unique_ids[unique_id].in_new ;
                            new_row = temp_currencies[i] ;
                            if (old_row.amount != new_row.amount) old_row.amount = new_row.amount ;
                            if (old_row.balance_at != new_row.balance_at) old_row.balance_at = new_row.balance_at ;
                        }
                        else {
                            // in old and not in new. delete. already done
                            continue ;
                        }
                    }
                    else {
                        // not in old. must be a new record. insert
                        i = unique_ids[unique_id].in_new ;
                        currencies.push(temp_currencies[i]) ;
                        continue ;
                    }

                } // for unique_id

                cb(currencies, delayed) ;

            }) ; // get_wallet_info


        } // get_currencies

        // export MoneyNetworkWService API
        return {
            get_session_info_key: get_session_info_key,
            ls_get_sessions: ls_get_sessions,
            ls_save_sessions: ls_save_sessions,
            w_login: w_login,
            w_logout: w_logout,
            get_currencies: get_currencies
        };

        // end MoneyNetworkWService
    }]) ;
