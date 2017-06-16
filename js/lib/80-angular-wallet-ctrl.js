angular.module('MoneyNetwork')

    .controller('WalletCtrl', ['$rootScope', '$window', '$location', '$timeout', 'MoneyNetworkService',
                     function ($rootScope, $window, $location, $timeout, moneyNetworkService)
    {
        var self = this;
        var controller = 'WalletCtrl';
        if (!MoneyNetworkHelper.getItem('userid')) {
            // not logged in - skip initialization of controller
            return;
        }
        console.log(controller + ' loaded');

        var BITCOIN_ADDRESS_PATTERN = '1[a-km-zA-HJ-NP-Z1-9]{25,34}' ;

        // create new sessionid for MoneyNetwork and MoneyNetwork wallet communication
        // sessionid: a "secret" sessionid URL parameter used when opening MoneyNetwork wallet site (only a secret when running ZeroNet local)
        // no event file done for "internal" cross site communication. dbQuery fetching will be used to detect new messages
        // using optional files and siteSign. sitePublish is not needed for "internal" cross site communication
        // message filenames:
        // - my messages: sha256.first(10).timestamp
        // - wallet messages: sha256.last(10).timestamp
        // messages between MoneyNetwork and MoneyNetwork wallet will be encrypted with cryptMessage, JSEncrypt and/or sessionid
        // messages will be deleted when read and processed
        MoneyNetworkAPI.setup_encryption({
            prvkey: MoneyNetworkHelper.getItem('prvkey'), // for JSEncrypt (decrypt incoming message)
            userid2: MoneyNetworkHelper.getUserId() // for cryptMessage (decrypt incoming message)
        }) ;
        function new_sessionid () {
            var pgm = controller + '.new_sessionid: ' ;
            var sha256 ;
            test_sessionid = MoneyNetworkHelper.generate_random_password(60, true).toLowerCase();
            MoneyNetworkAPI.setup_encryption({sessionid: test_sessionid, debug: true});
            sha256 = CryptoJS.SHA256(test_sessionid).toString() ;
            this_session_filename = sha256.substr(0,10) ; // first 10 characters of sha256 signature
            other_session_filename = sha256.substr(sha256.length-10); // last 10 characters of sha256 signature
            console.log(pgm + 'this_session_filename = ' + this_session_filename);
            console.log(pgm + 'other_session_filename = ' + other_session_filename);
        } // new_sessionid

        self.new_wallet_url = $location.search()['new_wallet_site'] ; // redirect from a MoneyNetwork wallet site?
        var tested_wallet_url = null ; // last tested url
        var test_sessionid ;
        var this_session_filename ; // MoneyNetwork (main windows/this session)
        var other_session_filename ; // MoneyNetwork wallet session (popup window)
        var test_session_at = null ;
        new_sessionid () ;

        function get_relative_url (url) {
            var pgm = controller + '.get_relative_url: ' ;
            var pos ;
            pos = url.indexOf('://') ;
            if (pos != -1) {
                // remove protocol (http, https etc)
                url = url.substr(pos+3) ;
                pos = url.indexOf('/') ;
                // remove domain from url (127.0.0.1 or proxy server)
                if (pos == -1) return null ; // cannot be a ZeroNet site URL
                url = url.substr(pos) ;
                return url ;
            }
            if (url.substr(0,1) == '/') return url ; // already a relative url ...
            if (url.match(new RegExp('^' + BITCOIN_ADDRESS_PATTERN + '$'))) return '/' + url ; // bitcoin address
            if (url.match(new RegExp('^' + BITCOIN_ADDRESS_PATTERN + '\/'))) return '/' + url ; // bitcoin address
            if (url.match(/\.bit$/)) return '/' + url ; // .bit domain
            if (url.match(/\.bit\//)) return '/' + url ; // .bit domain
            return null ;
        } // get_relative_url

        // https://stackoverflow.com/a/10997390/11236
        // https://stackoverflow.com/questions/1090948/change-url-parameters
        function updateURLParameter(url, param, paramVal){
            var newAdditionalURL = "";
            var tempArray = url.split("?");
            var baseURL = tempArray[0];
            var additionalURL = tempArray[1];
            var temp = "";
            if (additionalURL) {
                tempArray = additionalURL.split("&");
                for (var i=0; i<tempArray.length; i++){
                    if(tempArray[i].split('=')[0] != param){
                        newAdditionalURL += temp + tempArray[i];
                        temp = "&";
                    }
                }
            }
            var rows_txt = temp + "" + param + "=" + paramVal;
            return baseURL + "?" + newAdditionalURL + rows_txt;
        }

        self.show_test_new_wallet = function(context) {
            var pgm = controller + '.show_test_new_wallet: ' ;
            var show, relative_url ;
            if (!self.new_wallet_url) return false ;
            relative_url = get_relative_url(self.new_wallet_url) ;
            show = relative_url ? true : false ;
            //console.log(pgm + 'context = ' + context + ', show = ' + show + ', relative_url = ' + relative_url) ;
            return show ;
        };
        self.test_new_wallet = function() {
            var pgm = controller + '.test_new_wallet: ' ;
            if (!self.new_wallet_url) {
                ZeroFrame.cmd("wrapperNotification", ['error', 'Please enter new wallet URL', 5000]);
                return ;
            }
            tested_wallet_url = self.new_wallet_url ;
            run_tests() ;
        };
        self.reset_test = function () {
            var i ;
            // stop any running tests
            for (i=0 ; i<self.tests.length ; i++) {
                if (self.tests[i].info.text == 'Running') {
                    self.tests[i].info.test_failed = true ;
                    self.test_feedback(self.tests[i], 'failed') ;
                }
            }
            // test stopped
            self.test_running = false ;
            // reset test array
            init_tests() ;
            for (i=0 ; i<self.tests.length ; i++) {
                self.tests[i].info.status = 'Pending' ;
                delete self.tests[i].info.test_skipped ;
                delete self.tests[i].info.test_ok ;
                delete self.tests[i].info.test_failed ;
                delete self.tests[i].info.disabled ;
            }
            // new sessionid
            new_sessionid() ;
        };
        var test1_open_url = (function () {
            var pgm = controller + '.test1: ' ;
            var info = {
                no: 1,
                text: 'Open wallet URL',
                status: 'Pending'
            };
            function run() {
                var pgm = controller + '.test1.run: ' ;
                var url, json, inner_path ;
                if (['Test skipped', 'Test OK'].indexOf(info.status) != -1) {
                    // continue with next test
                    console.log(pgm + 'test ' + info.no + ' done. start test ' + (info.no + 1));
                    info.disabled = true;
                    test2_allow_popup.run();
                }
                else {
                    // start test 1. add sessionid to URL and open new window with wallet session
                    // sessionid: "secret" sessionid random 60 character password
                    // SHA256(sessionid).first(10).<timestamp>: MoneyNetwork session filename (optional file). this session
                    // SHA256(sessionid).last(10).<timestamp>: MoneyNetwork wallet session filename (optional file). other session
                    info.status = 'Running' ;
                    url = get_relative_url(self.new_wallet_url) ;
                    url = updateURLParameter(url, 'sessionid', test_sessionid) ;
                    console.log(pgm + 'url = ' + url) ;
                    ZeroFrame.cmd("wrapperOpenWindow", [url, "_blank"]);

                    // msg 1: MoneyNetwork: send my public keys to MoneyNetwork wallet session
                    moneyNetworkService.get_my_user_hub(function (hub) {
                        var pgm = controller + '.test1.run get_my_user_hub callback 1: ' ;
                        var user_path, json, inner_path, json_raw, debug_seq1 ;
                        json = {
                            msgtype: 'pubkeys',
                            pubkey: MoneyNetworkHelper.getItem('pubkey'), // for JSEncrypt
                            pubkey2: MoneyNetworkHelper.getItem('pubkey2') // for cryptMessage
                        } ;
                        // todo: validate json. API with msgtypes and validating rules
                        json_raw = unescape(encodeURIComponent(JSON.stringify(json, null, "\t")));
                        user_path = 'merged-MoneyNetwork/' + hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/' ;
                        inner_path = user_path + this_session_filename + '.' + (new Date().getTime()) ;
                        // write file
                        debug_seq1 = MoneyNetworkHelper.debug_z_api_operation_start('z_file_write', pgm + inner_path + ' fileWrite') ;
                        ZeroFrame.cmd("fileWrite", [inner_path, btoa(json_raw)], function (res) {
                            var pgm = controller + '.test1.run fileWrite callback 2: ' ;
                            var inner_path, debug_seq2 ;
                            MoneyNetworkHelper.debug_z_api_operation_end(debug_seq1) ;
                            console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            // sign. should update wallet database. publish is not needed.
                            inner_path = user_path + 'content.json' ;
                            debug_seq2 = MoneyNetworkHelper.debug_z_api_operation_start('z_site_publish', pgm + inner_path + ' siteSign') ;
                            ZeroFrame.cmd("siteSign", {inner_path: inner_path}, function (res) {
                                var pgm = controller + '.test1.run siteSign callback 3: ' ;
                                MoneyNetworkHelper.debug_z_api_operation_end(debug_seq2) ;
                                console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                test_session_at = new Date().getTime() ;
                            }) ; // siteSign callback 3

                        }) ; // writeFile callback 2

                    }) ; // get_my_user_hub callback 1

                } // if else
            } // run
            return {
                info: info,
                run: run
            };
        })(); // test1

        var test2_allow_popup = (function () {
            var pgm = controller + '.test2: ' ;
            var info = {
                no: 2,
                text: 'Popup allowed in browser',
                status: 'Pending'
            };
            function run () {
                var relative_url ;
                if (['Test skipped', 'Test OK'].indexOf(info.status) != -1) {
                    // continue with next test
                    console.log(pgm + 'test ' + info.no + ' done. start test ' + (info.no+1)) ;
                    info.disabled = true ;
                    test3_select_zeroid.run() ;
                }
                else {
                    // start test 2
                    info.status = 'Running' ;
                    ZeroFrame.cmd("wrapperConfirm", [info.text + '?'], function (ok) {
                        if (!ok) return ;
                        info.test_ok = true ;
                        self.test_feedback(test2_allow_popup, 'OK') ;
                        $rootScope.$apply() ;
                    }) ;
                }
            }
            return {
                info: info,
                run: run
            };
        })(); // test2

        var test3_select_zeroid = (function () {
            var pgm = controller + '.test3: ' ;
            var info = {
                no: 3,
                text: 'ZeroID selected in wallet',
                status: 'Pending'
            };
            function run () {
                var relative_url ;
                if (['Test skipped', 'Test OK'].indexOf(info.status) != -1) {
                    // continue with next test
                    console.log(pgm + 'test ' + info.no + ' done. start test ' + (info.no+1)) ;
                    info.disabled = true ;
                    test4_merger_moneynetwork.run() ;
                }
                else {
                    // start test 3
                    info.status = 'Running' ;
                    ZeroFrame.cmd('wrapperNotification', ['info', 'Please check that "ZeroId" is selected in wallet and click Test OK', 5000]);
                }
            }
            return {
                info: info,
                run: run
            };
        })(); // test3

        var test4_merger_moneynetwork = (function () {
            var pgm = controller + '.test4: ' ;
            var info = {
                no: 4,
                text: 'Merger:MoneyNetwork permission granted in wallet',
                status: 'Pending'
            };
            function run () {
                var relative_url ;
                if (['Test skipped', 'Test OK'].indexOf(info.status) != -1) {
                    // continue with next test
                    console.log(pgm + 'test ' + info.no + ' done. start test ' + (info.no+1)) ;
                    info.disabled = true ;
                    test5_check_session.run() ;
                }
                else {
                    // start test 4
                    info.status = 'Running' ;
                    ZeroFrame.cmd('wrapperNotification', ['info', 'Please check that "Merger:MoneyNetwork permission" is granted in wallet and click Test OK', 5000]);
                }
            }
            return {
                info: info,
                run: run
            };
        })(); // test4

        var test5_check_session = (function () {
            var pgm = controller + '.test5: ' ;
            var info = {
                no: 5,
                text: 'Checking session',
                status: 'Pending'
            };
            function run () {
                var relative_url, sessionid_sha256, query, json ;
                if (['Test skipped', 'Test OK'].indexOf(info.status) != -1) {
                    // test done
                    info.disabled = true ;
                    self.test_running = false ; ;
                }
                else {
                    // start test 5. wait for wallet feedback
                    info.status = 'Running' ;
                    console.log(pgm + 'todo: try a test without publish. siteSign should update content.json and database');

                    // wait for session to start. expects a pubkeys message from MoneyNetwork wallet session
                    // no event file done event. wait for db update. max 1 minute
                    sessionid_sha256 = CryptoJS.SHA256(test_sessionid).toString();
                    query =
                        "select json.directory, files_optional.filename, keyvalue.value as modified " +
                        "from files_optional, json, keyvalue " +
                        "where files_optional.filename like '" + other_session_filename + ".%' " +
                        "and json.json_id = files_optional.json_id " +
                        "and keyvalue.json_id = json.json_id " +
                        "and keyvalue.key = 'modified' " +
                        "and keyvalue.value > '" + ('' + test_session_at).substr(0,10) + "' " +
                        "order by filename" ;
                    MoneyNetworkHelper.debug('select', 'query 18 = ' + query) ;
                    var check_session = function(cb, count) {
                        var debug_seq ;
                        if (!count) count = 0;
                        if (count > 60) return cb({ error: "timeout" }) ;
                        debug_seq = MoneyNetworkHelper.debug_z_api_operation_start('z_db_query', pgm + 'query 18. count = ' + count) ;
                        ZeroFrame.cmd("dbQuery", [query], function (res) {
                            var pgm = controller + '.test5.check_session dbQuery callback 1: ' ;
                            var inner_path ;
                            MoneyNetworkHelper.debug_z_api_operation_end(debug_seq) ;
                            if (res.error) {
                                console.log(pgm + 'Error when checking for new wallet session. error = ' + res.error) ;
                                console.log(pgm + 'query = ' + query) ;
                                return cb({ error: res.error }) ;
                            }
                            if (res.length == 0) {
                                var job = function () { check_session(cb, count+1) };
                                $timeout(job, 1000) ;
                                return ;
                            }
                            // found message from wallet with correct filename .
                            inner_path = 'merged-MoneyNetwork/' + res[0].directory + '/' + res[0].filename ;
                            debug_seq = MoneyNetworkHelper.debug_z_api_operation_start('z_file_get', pgm + inner_path + ' fileGet') ;
                            ZeroFrame.cmd("fileGet", {inner_path: inner_path, required: false}, function (json_str) {
                                var pgm = controller + '.test5.check_session fileGet callback 2: ' ;
                                var json ;
                                MoneyNetworkHelper.debug_z_api_operation_end(debug_seq) ;
                                if (!json_str) return (cb({ error: 'File ' + inner_path + ' was not found'})) ;
                                console.log(pgm + 'encrypted_str = ' + JSON.stringify(json_str));
                                json = JSON.parse(json_str) ;
                                MoneyNetworkAPI.decrypt_json(json, function (json) {
                                    console.log(pgm + 'json = ' + JSON.stringify(json)) ;
                                    cb(json) ;
                                }) ;
                            }) ; // fileGet callback 2
                        }); // dbQuery callback 1
                    }; // check_session

                    // start session check. should wait for max 60 seconds for session handshake
                    check_session(function (res) {
                        var elapsed ;
                        if (res.error) {
                            console.log(pgm + 'wallet session was not found. error = ' + res.error) ;
                            info.status = 'Test failed' ;
                            info.disabled = true ;
                            self.test_running = false ;
                        }
                        else {
                            elapsed = res.session_at - test_session_at ;
                            console.log(pgm + 'new wallet session was found. pubkey2 = ' + res.pubkey2 + ', waited ' + Math.round(elapsed / 1000) + ' seconds') ;
                            info.status = 'Test OK' ;
                            info.disabled = true ;
                            self.test_running = false ;
                        }
                        console.log(pgm + 'check_session. res = ' + JSON.stringify(res)) ;
                        //res = {
                        //    "sessionid_sha256": "2be2c9a124cfb85c307aa771d906c5c316f02ac22d61a43e1c6806b6c65c057a",
                        //    "pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                        //    "session_at": 1496332540922,
                        //    "wallet_address": "1LqUnXPEgcS15UGwEgkbuTbKYZqAUwQ7L1",
                        //    "wallet_title": "MoneyNetworkW2",
                        //    "wallet_description": "Money Network - Wallet 2 - BitCoins www.blocktrail.com - runner jro"
                        //};
                        $rootScope.$apply() ;
                    }) ; // check_session callback
                } // end if else
            } // run
            return {
                info: info,
                run: run
            };
        })(); // test5

        self.tests = [] ;
        function init_tests () {
            self.tests.splice(0, self.tests.length) ;
            self.tests.push(test1_open_url) ;
            self.tests.push(test2_allow_popup) ;
            self.tests.push(test3_select_zeroid) ;
            self.tests.push(test4_merger_moneynetwork) ;
            self.tests.push(test5_check_session) ;
        }
        init_tests();
        self.test_running = false ;

        function run_tests() {
            self.test_running = true ;
            self.tests[0].run() ;
            return ;
        } // run_tests

        self.test_feedback = function (test, checkbox) {
            var checked ;
            if (checkbox=='skipped') checked = test.info.test_skipped ;
            if (checkbox=='OK') checked = test.info.test_ok ;
            if (checkbox=='failed') checked = test.info.test_failed ;

            // checkbox feedback (skip, ok or failed)
            if (checked) {
                // check
                test.info.old_status = test.info.status ; // save system status
                test.info.status = 'Test ' + checkbox ;
                if (checkbox == 'skipped') {
                    test.info.test_ok = false ;
                    test.info.test_failed = false ;
                    if (test.info.old_status == 'Running') test.run() ; // next test
                }
                if (checkbox == 'OK') {
                    test.info.test_skipped = false ;
                    test.info.test_failed = false ;
                    if (test.info.old_status == 'Running') test.run() ; // next test
                }
                if (checkbox == 'failed') {
                    test.info.test_skipped = false ;
                    test.info.test_ok = false ;
                }
            }
            else {
                // uncheck
                test.info.status = test.info.old_status ; // restore system status
                delete test.info.old_status ;
            }
        };

        self.show_add_new_wallet = function() {
            return (self.new_wallet_url && (self.new_wallet_url == tested_wallet_url)) ;

        };
        self.add_new_wallet = function () {
            var pgm = controller + '.add_new_wallet: ' ;
            console.log(pgm + 'new wallet url = ' + self.new_wallet_url) ;
        };

        // end WalletCtrl
    }])

;