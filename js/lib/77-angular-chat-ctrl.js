angular.module('MoneyNetwork')
    
    .controller('ChatCtrl', ['MoneyNetworkService', '$scope', '$timeout', '$routeParams', '$location', 'chatEditTextAreaIdFilter', 'chatEditImgIdFilter', 'formatChatMessageFilter', '$window',
        function (moneyNetworkService, $scope, $timeout, $routeParams, $location, chatEditTextAreaId, chatEditImgId, formatChatMessage, $window) {
            
            var self = this;
            var controller = 'ChatCtrl';
            if (!MoneyNetworkHelper.getItem('userid')) {
                // not logged in - skip initialization of controller
                return;
            }
            console.log(controller + ' loaded');
            $window.scrollTo(0, 0);

            // get user setup.
            self.setup = moneyNetworkService.get_user_setup() ;

            // two panel chat?
            (function(){
                var two_panel_chat = ($location.path().substr(0,6) == '/chat2') ;
                if (self.setup.two_panel_chat != two_panel_chat) {
                    // must be a direct link. update user setup
                    self.setup.two_panel_chat = two_panel_chat ;
                    moneyNetworkService.save_user_setup() ;
                }
            })() ;
            self.two_panel_chat_changed = function () {
                var pgm = controller + '.two_panel_chat_changed: ' ;
                moneyNetworkService.save_user_setup() ;
                // keep contact / group chat context when redirect between one and two panel chat pages
                var contact, path1, path2 ;
                if (self.group_chat) contact = find_group_chat_contact(true) ;
                else contact = self.contact ;
                path1 = self.setup.two_panel_chat ? '/chat2' : '/chat' ;
                path2 = contact ? '/' + contact.unique_id : '' ;
                $location.path(path1 + path2);
                $location.replace();
            };

            // contact removed from top of chat. see all chat messages
            self.see_all_chat = function () {
                self.contact = null ;
                self.group_chat = false ;
                self.group_chat_contacts.splice(self.group_chat_contacts.length) ;
                self.editing_grp_chat = false ;
            };

            // group contact functions.
            // click on glyphicon-pushpin to edit participants in group chat
            // click on glyphicon-ok or send chat message when done editing chat group
            self.group_chat = false ;
            self.group_chat_contacts = [] ;
            self.editing_grp_chat = false ;

            // find group chat contact from self.group_chat_contacts array
            // params (create):
            // - false (default) - do not create pseudo group contact
            // - true - create pseudo group chat contact if pseudo group chat contact does not exists
            // returns:
            // - null - not group chat
            // - string - group chat unique_id - pseudo group chat contact does not exists (create != true)
            // - contact - contact or pseudo group chat contact
            function find_group_chat_contact (create) {
                var pgm = controller + '.find_group_chat_unique_id: ' ;
                if (self.group_chat_contacts.length == 0) return null ;
                if (self.group_chat_contacts.length == 1) return self.group_chat_contacts[0] ;
                // calculate group chat unique_id from participants in group chat
                var my
                var my_pubkey = MoneyNetworkHelper.getItem('pubkey');
                var my_auth_address = ZeroFrame.site_info.auth_address ;
                var my_unique_id = CryptoJS.SHA256(my_auth_address + '/'  + my_pubkey).toString();
                var i, j ;
                // console.log(pgm + 'my_unique_id = ' + my_unique_id);
                var group_chat_contact_unique_ids = [my_unique_id] ;
                for (i=0 ; i<self.group_chat_contacts.length ; i++) {
                    group_chat_contact_unique_ids.push(self.group_chat_contacts[i].unique_id) ;
                } // for i
                group_chat_contact_unique_ids.sort() ;
                // console.log(pgm + 'group_chat_contact_unique_ids = ' + JSON.stringify(group_chat_contact_unique_ids)) ;
                var group_unique_id = CryptoJS.SHA256(JSON.stringify(group_chat_contact_unique_ids)).toString() ;
                // console.log(pgm + 'group_unique_id = ' + group_unique_id) ;
                for (i=0 ; i<self.contacts.length ; i++) {
                    if (self.contacts[i].unique_id == group_unique_id) return self.contacts[i] ;
                }
                if (!create) return group_unique_id ;
                // create pseudo chat group contact without password. password will be added when sending first chat message in this group
                var contact = {
                    unique_id: group_unique_id,
                    type: 'group',
                    password: null,
                    participants: [],
                    search: [],
                    messages: []
                };
                for (i=0 ; i<self.group_chat_contacts.length ; i++) {
                    contact.participants.push(self.group_chat_contacts[i].unique_id) ;
                } // for i
                self.contacts.push(contact);
                moneyNetworkService.ls_save_contacts(false);
                return contact ;
            }

            self.start_editing_grp_chat = function () {
                var pgm = controller + 'start_edit_grp_chat: ';
                if (!self.chat_hint_pushpin()) {
                    console.log(pgm + 'pushpin not allowed') ;
                    return ;
                }
                var info;
                if (self.setup.two_panel_chat) info = "Click on avatars to add/remove participants in this group chat" ;
                else info = "Click on avatars to remove participants from this group chat" ;
                if (self.group_chat) {
                    // start, stop, start editing group chat. just continue already group
                    // console.log(pgm + 'start, stop, start editing group chat. just continue already group') ;
                    self.editing_grp_chat = true ;
                    ZeroFrame.cmd("wrapperNotification", ["info", info , 5000]);
                    return ;
                }
                if (!self.contact.pubkey) {
                    ZeroFrame.cmd("wrapperNotification", ["error", "Cannot start group chat with this contact. Public key is missing", 5000]);
                    return ;
                }
                ZeroFrame.cmd("wrapperNotification", ["info", info , 5000]);
                self.group_chat = true ;
                self.editing_grp_chat = true ;
                for (var i=0 ; i<self.contacts.length ; i++) {
                    if (self.contacts[i].unique_id == self.contact.unique_id) {
                        self.group_chat_contacts = [self.contacts[i]] ;
                        return ;
                    }
                }
            }; // start_editing_grp_chat

            self.stop_editing_grp_chat = function () {
                var pgm = controller + '.stop_edit_grp_chat: ' ;
                if (self.group_chat_contacts.length == 0) {
                    ZeroFrame.cmd("wrapperNotification", ["error", "Please some participants to chat first", 5000]);
                    return ;
                }
                else if (self.group_chat_contacts.length == 1) {
                    // one and only one contact in chat group. display normal contact info
                    self.editing_grp_chat = false ;
                    self.contact = self.group_chat_contacts[0] ;
                    self.group_chat = false ;
                    self.group_chat_contacts = [] ;
                }
                else {
                    // calc new unique id for this chat group and find/create pseudo group chat contact
                    // do not create pseudo group chat contact yet
                    self.editing_grp_chat = false ;
                    var contact = find_group_chat_contact(true) ;
                    console.log(pgm + 'contact = ' + JSON.stringify(contact)) ;
                    if (contact && (typeof contact == 'object')) self.contact = contact ;
                }
            }; // stop_editing_grp_chat

            self.grp_chat_add = function (contact) {
                var pgm = controller + '.grp_chat_add: ' ;
                if (!self.editing_grp_chat) {
                    // not editing chat grp. simple redirect
                    self.chat_contact(contact) ;
                    return ;
                }
                if (contact.type == 'group') return ; // todo: allow adding a old chat group to new chat group?
                // is contact already in self.group_chat_contacts array?
                var index = -1 ;
                for (var i=0 ; i<self.group_chat_contacts.length ; i++) {
                    if (self.group_chat_contacts[i].unique_id == contact.unique_id) index = i ;
                }
                if (index == -1) {
                    // console.log(pgm + 'adding contact with hashkey ' + contact["$$hashKey"] + ' to this group chat') ;
                    if (!contact.pubkey) {
                        ZeroFrame.cmd("wrapperNotification", ["error", "Cannot add this contact to group chat. Public key is missing", 5000]);
                        return ;
                    }
                    self.group_chat_contacts.push(contact) ;
                }
                else {
                    // console.log(pgm + 'removing contact with hashkey ' + contact["$$hashKey"] + ' from this group chat') ;
                    self.group_chat_contacts.splice(index,1) ;
                    if (!self.setup.two_panel_chat && (self.group_chat_contacts.length == 0)) {
                        // one panel chat and participant has been removed
                        self.see_all_chat() ;
                    }
                }
                // console.log(pgm + 'self.group_chat_contacts = ' + JSON.stringify(self.group_chat_contacts)) ;
            }; // grp_chat_add

            // chat group participants - aquamarine background color for selected participants.
            self.contact_background_color = function (contact) {
                var pgm = controller + '.background_color: ' ;
                var style ;
                if (!self.editing_grp_chat) return {} ;
                var index = -1 ;
                for (var i=0 ; i<self.group_chat_contacts.length ; i++) {
                    if (self.group_chat_contacts[i].unique_id == contact.unique_id) index = i ;
                }
                if (index == -1) return {} ;
                else return {'background-color':'aquamarine'};
            }; // contact_background_color

            // get contacts. two different types of contacts:
            // a) contacts stored in localStorage
            self.contacts = moneyNetworkService.ls_get_contacts() ; // array with contacts from localStorage
            // b) search for new ZeroNet contacts using user info (Search and Hidden keywords)
            self.zeronet_search_contacts = function() {
                MoneyNetworkHelper.z_contact_search(self.contacts, function () {$scope.$apply()}) ;
            };
            self.zeronet_search_contacts() ;

            self.contact = null;
            self.messages = moneyNetworkService.js_get_messages();
            // console.log(controller + ': messages = ' + JSON.stringify(self.messages));

            // disabled chat. contact without public key. span with explanation about deleting old inactive accounts
            self.no_days_before_cleanup = moneyNetworkService.get_no_days_before_cleanup() ;

            // find contact. only relevant if chat is called from contact page
            function find_contact() {
                var pgm = controller + '.find_contact: ';
                var unique_id = $routeParams.unique_id;
                for (var i = 0; i < self.contacts.length; i++) {
                    if (self.contacts[i].unique_id == unique_id) {
                        self.contact = self.contacts[i];
                        if (!self.contact.messages) self.contact.messages = [];
                        // console.log(pgm + 'contact = ' + JSON.stringify(self.contact));
                        return
                    }
                }
                console.log(pgm + 'contact with unique id ' + unique_id + ' was not found');
            } // find_contact
            if ($routeParams.unique_id) find_contact();

            function init_group_chat_contacts (contact) {
                var pgm = controller + '.init_group_chat_contacts: ' ;
                // this function should only be used for group contacts
                if (contact.type != 'group') {
                    console.log(pgm + 'not a pseudo chat contact') ;
                    return ;
                }
                // initialize group_chat
                var i, unique_id, index, j ;
                // console.log(controller + ': initialise group chat from group chat pseudo contact');
                self.group_chat_contacts.splice(0, self.group_chat_contacts.length) ;
                for (i=0 ; i<self.contact.participants.length ; i++) {
                    unique_id = self.contact.participants[i] ;
                    index = -1 ;
                    for (j=0 ; j<self.contacts.length ; j++) {
                        if (unique_id == self.contacts[j].unique_id) {
                            index = j ;
                            break ;
                        };
                    } // for j
                    if (index == -1) console.log(controller + ': contact with unique id ' + unique_id + ' was not found') ;
                    else self.group_chat_contacts.push(self.contacts[index]) ;
                } // for i
                self.group_chat = true ;
                // console.log(controller + ': initialize group_chat_contacts. self.group_chat_contacts = ' + JSON.stringify(self.group_chat_contacts)) ;
            }

            if (self.contact) {
                (function () {
                    if (self.contact.type == 'group') init_group_chat_contacts(self.contact) ;
                    var focus_new_chat_msg = function() {
                        document.getElementById('new_chat_msg').focus() ;
                    };
                    $timeout(focus_new_chat_msg);

                })() ;
            }

            self.avatar = moneyNetworkService.get_avatar();

            // quick instructions for newcomers
            self.show_welcome_msg1 = function () { // any contacts?
                if (!self.contacts) return true ;
                return (self.contacts.length == 0) ;
            }; // show_welcome_msg1
            self.show_welcome_msg2 = function () { // any messages?
                if (self.show_welcome_msg1()) return false ;
                if (self.contact) return false ;
                for (var i=0 ; i<self.contacts.length ; i++) {
                    if (self.contacts[i].messages && self.contacts[i].messages.length) return false ;
                }
                return true ;
            }; // show_welcome_msg2
            self.show_no_welcome = function() { // no special messages
                if (self.show_welcome_msg1()) return false ;
                if (self.show_welcome_msg2()) return false ;
                return true ;
            };

            // hints to guide user to next step in chat process + show/hide pushpin, ok and remove glyphicon
            function chat_hint_account_page () {
                return (!self.contacts || (self.contacts.length == 0))
            }
            function chat_hint_network_page () {
                return (!self.setup.two_panel_chat && !self.contact && (self.messages.length == 0))
            }
            function chat_hint_start_chat () {
                return (!self.contact && !self.group_chat)
            }
            self.chat_hint_chatting = function () {
                if (chat_hint_account_page() || chat_hint_network_page() || chat_hint_start_chat()) return false ;
                else return true ;
            };
            self.chat_hint_send = function () {
                if (!self.chat_hint_chatting()) return false ;
                // send chat message?
                return ((self.contact && self.contact.pubkey && !self.group_chat) ||
                        (self.group_chat && (self.group_chat_contacts.length > 0))) ;

            };
            self.chat_hint_pubkey = function () {
                if (!self.chat_hint_chatting()) return false ;
                // missing public key for contact?
                return (self.contact && (self.contact.type != 'group') && !self.contact.pubkey) ;
            };
            self.chat_hint_pushpin = function () {
                if (self.editing_grp_chat) return false ;
                if (self.setup.two_panel_chat) return (!self.chat_hint_pubkey()) ;
                else return (self.group_chat_contacts.length > 1) ;
            } ;
            self.chat_hint = function () {
                // start up hints - user is not chatting
                if (chat_hint_account_page()) return 'No contacts were found. Please go to "Account" page and enter/update search tags.' ;
                if (chat_hint_network_page()) return 'Click on "Network page" or enable "Two panel chat" to see contacts' ;
                if (chat_hint_start_chat()) return 'Click on an avatar to start chat';

                // user is chatting - concatenate hints
                var send, pubkey, avatar, pushpin, ok, x  ;
                if (self.chat_hint_send()) send = true ;
                if (self.chat_hint_pubkey()) pubkey = true ;
                if (self.editing_grp_chat) avatar = true ;
                if (self.chat_hint_pushpin()) pushpin = true ;
                if (self.editing_grp_chat && (self.group_chat_contacts.length > 0)) ok = true ;
                x = true ;

                var msg = [] ;
                if (send) msg.push('Send message') ;
                if (pubkey) msg.push('Cannot chat with this contact. Public key was not found');
                if (avatar) {
                    if (self.setup.two_panel_chat) msg.push('Click on avatars to update participants') ;
                    else msg.push('Click on avatars to remove participants') ;
                }
                if (pushpin) {
                    if (self.setup.two_panel_chat) msg.push('Click pushpin to update participants');
                    else msg.push('Click pushpin to remove participants');
                }
                if (ok) msg.push('Click OK when done');
                if (x) msg.push('X = all messages') ;
                return msg.join(' / ') ;
            };

            // edit contact.alias functions
            // todo: almost identical code in NetworkCtrl. Refactor to MoneyNetworkService
            self.edit_alias_title = "Edit alias. Press ENTER to save. Press ESC to cancel" ;
            var edit_alias_notifications = 1 ;
            self.edit_alias = function (contact) {
                var pgm = controller + '.edit_alias: ', i, id ;
                if (contact) {
                    // left panel (network) edit contact alias
                    id = contact["$$hashKey"] + ":alias"
                }
                else {
                    // right panel (chat) edit contact alias
                    id = 'contact_alias_id';
                    contact = self.contact ;
                }
                if (contact.alias) contact.new_alias = contact.alias ;
                else if (contact.type == 'group') contact.new_alias = contact.unique_id.substr(0,13);
                else {
                    i = contact.cert_user_id.indexOf('@') ;
                    contact.new_alias = contact.cert_user_id.substr(0,i) ;
                }
                contact.edit_alias = true ;
                if (edit_alias_notifications > 0) {
                    ZeroFrame.cmd("wrapperNotification", ["info", self.edit_alias_title, 5000]);
                    edit_alias_notifications-- ;
                }
                // set focus - in a timeout - wait for angularJS
                var set_focus = function () { document.getElementById(id).focus() } ;
                $timeout(set_focus) ;
            } ; // edit_alias
            self.cancel_edit_alias = function (contact) {
                var pgm = controller + '.cancel_edit_alias: ' ;
                console.log(pgm + 'contact = ' + JSON.stringify(contact));
                if (!contact) contact = self.contact ; // right panel
                delete contact.new_alias ;
                delete contact.edit_alias ;
                $scope.$apply() ;
            } ; // cancel_edit_alias
            self.save_user_info = function (contact) {
                var pgm = controller + '.save_user_info: ';
                if (!contact) contact = self.contact ; // right panel
                // update angular UI
                contact.alias = contact.new_alias ;
                delete contact.new_alias ;
                delete contact.edit_alias ;
                $scope.$apply() ;
                // save contacts in localStorage
                // console.log(pgm + 'calling ls_save_contacts') ;
                moneyNetworkService.ls_save_contacts(false) ;
            }; // save_user_info


            // filter contacts in chat. show chat from contacts with green filter. hide chat from contacts with red filter
            // saved in localStorage.setup.contact_filters (per user)
            // todo: refactor: same functions are used in network controller
            self.toggle_filter = function (filter) {
                var pgm = controller + '.toggle_filter: ' ;
                if (self.setup.contact_filters[filter] == 'green') self.setup.contact_filters[filter] = 'red' ;
                else self.setup.contact_filters[filter] = 'green' ;
                // special action for all
                if (filter == 'all') {
                    if (self.setup.contact_filters['all'] == 'green') {
                        // all: red => green. set all filters to green
                        for (filter in self.setup.contact_filters) self.setup.contact_filters[filter] = 'green' ;
                    }
                    else {
                        // all: green => red. set all filters to red if all filters are green
                        if (self.setup.contact_filters.new == 'red') return ;
                        if (self.setup.contact_filters.unverified == 'red') return ;
                        if (self.setup.contact_filters.verified == 'red') return ;
                        if (self.setup.contact_filters.ignore == 'red') return ;
                        for (filter in self.setup.contact_filters) self.setup.contact_filters[filter] = 'red' ;
                    }
                }
                else if ((self.setup.contact_filters[filter] == 'red') && (self.setup.contact_filters.all == 'green')) self.setup.contact_filters.all = 'red' ;
                moneyNetworkService.save_user_setup() ;
            };

            self.contact_add = function () {
                moneyNetworkService.contact_add(self.contact);
            };
            self.contact_ignore = function () {
                moneyNetworkService.contact_ignore(self.contact);
            }; // unignore new contact
            self.contact_unplonk = function () {
                moneyNetworkService.contact_unplonk(self.contact);
            };
            self.contact_verify = function () {
                moneyNetworkService.contact_verify(self.contact);
            };
            self.show_contact_delete = function() {
                var pgm = controller + '.show_contact_delete: ' ;
                if (!self.contact) return false ;
                var no_msg = 0, i, message ;
                for (i=0 ; i<self.contact.messages.length ; i++) {
                    message = self.contact.messages[i];
                    if (!message.deleted_at) no_msg++ ;
                } // for i
                if (no_msg > 0) return true ;
                if (!self.contact.pubkey) return true ;
                return false ;
            };
            self.contact_delete = function () {
                var pgm = controller + '.contact_delete: ' ;
                if (moneyNetworkService.contact_delete(self.contact)) {
                    // contact deleted. show chat for all contacts
                    var location = $location.path('/chat');
                    console.log(pgm + 'old location = ' + location);
                    var index = location.lastIndexOf('/');
                    location = location.substr(0,index);
                    console.log(pgm + 'new location = ' + location);
                    $location.path(location);
                    $location.replace();
                }
            };
            self.show_verify_icon = function (message) {
                if (message.message.folder != 'inbox') return false ;
                if (message.message.message.msgtype != 'verify') return false ;
                if (!message.message.message.password_sha256) return false ;
                return true ;
            };
            self.show_image = function (message) {
                var pgm = controller + '.show_image: ' ;
                var show ;
                if (message.message.message.msgtype != 'chat msg') show=false ;
                else if (message.message.message.image) show=true ;
                else show=false ;
                // console.log(pgm + 'messsage = ' + JSON.stringify(message.message.message).substr(0,100) + ', show = ' + show);
                return show ;
            };
            self.enter_password = function (message) {
                ZeroFrame.cmd("wrapperPrompt", ["Enter verification password:", "text"], function (password) {
                    var pgm = controller + '.enter_password: ';
                    console.log(pgm + 'message.message = ' + JSON.stringify(message.message));
                    console.log(pgm + 'password = ' + password) ;
                    var expected_sha256 = message.message.message.password_sha256 ;
                    var found_sha256 = CryptoJS.SHA256(password).toString() ;
                    if (expected_sha256 != found_sha256) {
                        ZeroFrame.cmd("wrapperNotification", ["error", 'Invalid verification password. Try again', 3000]);
                        self.enter_password(message);
                        return ;
                    }
                    console.log(pgm + 'password is correct');
                    var verified_message = { msgtype: 'verified', password: password } ;
                    // validate json
                    var error = MoneyNetworkHelper.validate_json (pgm, verified_message, verified_message.msgtype, 'Password was correct but verification response was not sent to contact') ;
                    if (error) {
                        moneyNetworkService.ls_save_contacts(false);
                        ZeroFrame.cmd("wrapperNotification", ["Error", error]);
                        return ;
                    }
                    // send message
                    moneyNetworkService.add_msg(message.contact, verified_message) ;
                    moneyNetworkService.ls_save_contacts(true) ;
                    // notification
                    delete message.message.message.password_sha256 ;
                    ZeroFrame.cmd("wrapperNotification", ["info", "Verification OK", 3000]);
                });
            }; // enter_password

            self.contact_remove = function () {
                moneyNetworkService.contact_remove(self.contact);
            };

            // filter and order by used in ng-repeat messages filter
            self.chat_filter = function (message, index, messages) {
                var pgm = controller + '.chat_filter: ';
                var match ;
                if (message.message.deleted_at) match = false ;
                else if (!self.contact) {
                    // show chat for all contacts. Use green/red filter in top of page
                    match = (self.setup.contact_filters[message.contact.type] == 'green');
                }
                else match = (self.contact.unique_id == message.contact.unique_id); // show chat for one contact
                // console.log(pgm + 'local_msg_seq = ' + message.message.local_msg_seq + ', folder = ' + message.message.folder + ', match = ' + match);
                return match;
            }; // chat_filter

            self.contact_filter = function (contact, index, contacts) {
                var pgm = controller + '.contact_filter: ';
                var i, unique_id, j ;
                if (contact.type == 'group') {
                    // display group if one participant is within current filter
                    for (var i=0 ; i<contact.participants.length ; i++) {
                        unique_id = contact.participants[i] ;
                        for (j=0 ; j<contacts.length ; j++) {
                            if (contacts[j].unique_id == unique_id) {
                                if (self.setup.contact_filters[contacts[j].type] == 'green') return true ;
                                break ;
                            }
                        }
                    }
                    return false ;
                }
                else {
                    // simpel contact filter
                    return (self.setup.contact_filters[contact.type] == 'green');
                }
                return match ;
            };

            // contacts sort options - typeahead auto complete functionality
            // todo: refactor - also used in network controller
            self.contact_sort_options = moneyNetworkService.get_contact_sort_options();
            self.contact_sort_title = moneyNetworkService.get_contact_sort_title();
            self.contact_sort_changed = function () {
                var pgm = controller + '.sort_changed: ' ;
                moneyNetworkService.save_user_setup();
            };

            self.contact_order_by = function (contact) {
                return moneyNetworkService.contact_order_by(contact);
            }; // contact_order_by

            // chat sort options - typeahead auto complete functionality
            self.chat_sort_options = moneyNetworkService.get_chat_sort_options() ; 
            self.chat_sort_title = moneyNetworkService.get_chat_sort_title() ;
            self.chat_sort_changed = function () {
                var pgm = controller + '.sort_changed: ' ;
                console.log(pgm + 'chat_sort = ' + self.chat_sort) ;
                moneyNetworkService.save_user_setup();
            };
            self.chat_order_by = function (message) {
                return moneyNetworkService.chat_order_by(message) ;
            }; // chat_order_by

            // todo: also chat_contact method in network controller. refactor
            self.chat_contact = function (contact) {
                // var pgm = controller + '.chat_contact: ';
                if (self.contact && (self.contact.unique_id == contact.unique_id)) return ;
                // clear any old not sent chat
                self.new_chat_msg = '';
                self.new_chat_src = null ;
                // new contact
                self.contact = contact ;
                if (contact.type == 'group') init_group_chat_contacts(contact) ;
                else {
                    moneyNetworkService.notification_if_old_contact(contact);
                    self.group_chat = false ;
                    self.group_chat_contacts.splice(0,self.group_chat_contacts.length) ;
                }
            }; // chat_contact

            self.new_chat_msg = '';
            self.new_chat_src = null ;

            self.handleTextAreaHeight = function (e) {
                var element = e.target;
                element.style.overflow = 'hidden';
                element.style.height = 0;
                element.style.height = element.scrollHeight + 'px';
            };
            self.send_chat_msg = function () {
                var pgm = controller + '.send_chat_msg: ';
                // check image attachment
                if (self.new_chat_src && !moneyNetworkService.get_image_ext_from_base64uri(self.new_chat_src)) {
                    ZeroFrame.cmd(
                        "wrapperNotification", ["error", "Ups. Something is wrong here.<br>" +
                        "Only png, jpg, jpeg, gif and tif images can be used in chat<br>" +
                        "Sending chat message without image", 5000]);
                    self.new_chat_src='';
                }

                var i, j, contact, password, password, my_pubkey, my_auth_address, my_unique_id, message, error ;
                // group chat? find/create pseudo contact for this chat group.
                self.editing_grp_chat = false ;
                if (self.group_chat) {
                    contact = find_group_chat_contact(true) ; // create pseudo group chat contact if not found
                    if (!contact) return ;
                    if (contact.type != 'group') {
                        self.contact = contact ;
                        self.group_chat = false;
                        self.group_chat_contacts = [];
                    }
                }
                if (self.group_chat) {
                    if (!contact.password) {
                        // new pseudo group chat contact. generate password and send password to participants
                        my_pubkey = MoneyNetworkHelper.getItem('pubkey');
                        my_auth_address = ZeroFrame.site_info.auth_address ;
                        my_unique_id = CryptoJS.SHA256(my_auth_address + '/'  + my_pubkey).toString();

                        password = MoneyNetworkHelper.generate_random_password(200);
                        contact.password = password;
                        // send password to participants
                        for (i = 0; i < self.group_chat_contacts.length; i++) {
                            message = {
                                msgtype: 'group chat',
                                participants: [],
                                password: password
                            };
                            // add participants. Sender and receiver not included
                            for (j = 0; j < contact.participants.length; j++) {
                                if (contact.participants[j] == my_unique_id) continue;
                                if (contact.participants[j] == self.group_chat_contacts[i].unique_id) continue;
                                message.participants.push(contact.participants[j]);
                            }
                            console.log(pgm + 'message = ' + JSON.stringify(message));
                            // validate json
                            error = MoneyNetworkHelper.validate_json(pgm, message, message.msgtype, 'Could not send chat message');
                            if (error) {
                                ZeroFrame.cmd("wrapperNotification", ["Error", error]);
                                return;
                            }
                            // send group chat message
                            moneyNetworkService.add_msg(self.group_chat_contacts[i], message);
                        } // for i
                    }
                }
                else contact = self.contact ;

                // send chat message to contact
                message = {
                    msgtype: 'chat msg',
                    message: self.new_chat_msg
                };
                if (self.new_chat_src) message.image = self.new_chat_src ;
                MoneyNetworkHelper.debug('outbox && unencrypted', pgm + 'message = ' + JSON.stringify(message));
                // validate json
                error = MoneyNetworkHelper.validate_json(pgm, message, message.msgtype, 'Could not send chat message');
                if (error) {
                    ZeroFrame.cmd("wrapperNotification", ["Error", error]);
                    return;
                }
                // console.log(pgm + 'last_sender_sha256 = ' + last_sender_sha256);
                // send message
                moneyNetworkService.add_msg(contact, message);
                // ready for next chat msg
                self.new_chat_msg = '';
                self.new_chat_src = null ;
                // console.log(pgm + 'contact = ' + JSON.stringify(contact));
                // update localStorage and ZeroNet
                // console.log(pgm + 'calling ls_save_contacts');
                moneyNetworkService.ls_save_contacts(true);
            }; // send_chat_msg

            self.changed_chat_msg = "";
            self.edit_chat_msg = function (message) {
                var pgm = controller + '.edit_chat_msg: ';
                console.log(pgm + 'message.message = ' + JSON.stringify(message.message));
                if ((message.message.folder == 'outbox') && (message.message.message.msgtype == 'chat msg')) {
                    // edit previously sent chat message. must send changed chat msg to contact
                    message.edit_chat_message = true;
                    // angularJS cheat - ng-bind is too slow - using id for get/set textarea value. Maybe also a problem with handleTextAreaHeight?
                    var textarea_id = chatEditTextAreaId(message);
                    document.getElementById(textarea_id).value = message.message.message.message;
                    var img_id = chatEditImgId(message) ;
                    // console.log(pgm + 'img_id = ' + img_id);
                    if (message.message.message.image) {
                        message.message.message.original_image = message.message.message.image ;
                        document.getElementById(img_id).src = message.message.message.image ;
                    }
                    // focus to edit chat message textarea field
                    var focus_textarea = function () {
                        var id = textarea_id + '' ;
                        document.getElementById(id).focus() ;
                    };
                    $timeout(focus_textarea);
                }
                else {
                    // just delete other type of messages from localStorage (ingoing chat messages, contact added, contact deleted etc)
                    var msg_text = formatChatMessage(message);
                    if (msg_text.length > 40) msg_text = msg_text.substring(0, 20) + "..." + msg_text.substring(msg_text.length - 15);
                    // console.log(pgm + 'msg_text.length = ' + msg_text.length);
                    ZeroFrame.cmd("wrapperConfirm", ['Delete "' + msg_text + '" message?', "Delete"], function (confirmed) {
                        if (!confirmed) return;
                        // console.log(pgm + 'delete message. message = ' + JSON.stringify(message));
                        message.message.deleted_at = new Date().getTime(); // logical delete
                        var index = null;
                        for (var i = 0; i < self.messages.length; i++) if (self.messages[i]["$$hashKey"] == message["$$hashKey"]) index = i;
                        // console.log(pgm + 'index = ' + index);
                        // remove from UI
                        self.messages.splice(index, 1);
                        $scope.$apply();
                        // update localStorage and optional zeronet
                        var update_zeronet = ((message.message.folder == 'outbox') && message.message.zeronet_msg_id) ;
                        moneyNetworkService.ls_save_contacts(update_zeronet);
                    }); // wrapperConfirm
                }
            }; // edit_chat_msg
            self.edit_chat_message_remove_image = function (message) {
                // remove from UI and message. old image is still in message.message.message.original_image ;
                var img_id = chatEditImgId(message) ;
                document.getElementById(img_id).src = '' ;
                delete message.message.message.image ;
            } ;
            self.cancel_edit_chat_msg = function (message) {
                var pgm = controller + '.cancel_edit_chat_msg: ';
                // angularJS cheat - ng-bind is too slow - using id for get/set textarea value. Maybe also a problem with handleTextAreaHeight?
                delete message.edit_chat_message ;
                var textarea_id = chatEditTextAreaId(message);
                textarea_id.value = '' ;
                if (message.message.message.original_image) {
                    message.message.message.image = message.message.message.original_image ;
                    delete message.message.message.original_image ;
                }
                var img_id = chatEditImgId(message) ;
                document.getElementById(img_id).src = null ;
            }; // cancel_edit_chat_msg
            self.save_chat_msg = function (message) {
                var pgm = controller + '.save_chat_msg: ';
                // angularJS cheat - ng-bind is too slow - using id for get/set textarea value. Maybe also a problem with handleTextAreaHeight?
                var textarea_id = chatEditTextAreaId(message);
                var old_value = message.message.message.message;
                var new_value = document.getElementById(textarea_id).value;
                document.getElementById(textarea_id).value = '' ;
                console.log(pgm + 'old message = ' + JSON.stringify(message.message));
                console.log(pgm + 'old value = ' + old_value);
                console.log(pgm + 'new value = ' + new_value);
                var old_image = message.message.message.original_image ;
                delete message.message.message.original_image ;
                var img_id = chatEditImgId(message) ;
                var new_image = document.getElementById(img_id).src ;
                if (new_image.match(/^http/)) new_image = null ;
                document.getElementById(img_id).src = '' ;
                delete message.edit_chat_message;
                if ((!new_value || (old_value == new_value)) && (old_image == new_image)) return;
                // send changed chat message
                var changed_message = {
                    msgtype: 'chat msg',
                    old_local_msg_seq: message.message.local_msg_seq,
                    message: new_value
                };
                // add image.
                // unchanged image will be replaced with a "x" in communication. See z_update_data_json and process_incoming_message
                if (new_image) changed_message.image = new_image ;
                console.log(pgm + 'changed_message = ' + JSON.stringify(changed_message));
                // validate json
                var error = MoneyNetworkHelper.validate_json(pgm, changed_message, changed_message.msgtype, 'Could not send changed chat message');
                if (error) {
                    ZeroFrame.cmd("wrapperNotification", ["Error", error]);
                    return;
                }
                if (new_image && (old_image == new_image)) changed_message.replace_unchanged_image_with_x = true ;
                // console.log(pgm + 'last_sender_sha256 = ' + last_sender_sha256);
                // send message
                moneyNetworkService.add_msg(message.contact, changed_message);
                // delete old message
                console.log(pgm + 'todo: keep old message in some kind of edit history?');
                message.message.deleted_at = new Date().getTime() ;
                // save localStorage and update ZeroNet
                moneyNetworkService.ls_save_contacts(true) ;
            }; // save_chat_msg
            self.delete_edit_chat_msg = function (message) {
                // called from edit chat message form. Always outbox message
                var pgm = controller + '.delete_edit_chat_msg: ';
                var msg_text = formatChatMessage(message);
                if (msg_text.length > 40) msg_text = msg_text.substring(0, 20) + "..." + msg_text.substring(msg_text.length - 15);
                console.log(pgm + 'msg_text.length = ' + msg_text.length);
                ZeroFrame.cmd("wrapperConfirm", ['Delete "' + msg_text + '" message?', "Delete"], function (confirmed) {
                    if (!confirmed) return;
                    console.log(pgm + 'deleting message ' + JSON.stringify(message));
                    // outbox: send delete chat message. note empty chat message
                    var delete_message = {
                        msgtype: 'chat msg',
                        old_local_msg_seq: message.message.local_msg_seq
                    };
                    console.log(pgm + 'delete_message = ' + JSON.stringify(delete_message));
                    // validate json
                    var error = MoneyNetworkHelper.validate_json(pgm, delete_message, delete_message.msgtype, 'Could not send delete chat message');
                    if (error) {
                        ZeroFrame.cmd("wrapperNotification", ["Error", error]);
                        return;
                    }
                    // console.log(pgm + 'last_sender_sha256 = ' + last_sender_sha256);
                    // send message
                    moneyNetworkService.add_msg(message.contact, delete_message);
                    // delete old message
                    delete message.edit_chat_message;
                    message.message.deleted_at = new Date().getTime();
                    delete message.message.image;
                    // delete new message (just created delete chat message message)
                    message.contact.messages[message.contact.messages.length - 1].deleted_at = new Date().getTime();
                    // save localStorage and update ZeroNet
                    moneyNetworkService.ls_save_contacts(true);
                }); // wrapperConfrm
            }; // delete_edit_chat_msg

            // catch drag and drop new chat message image. see imagedrop directive. todo: refactor
            self.imageDropped = function () {
                var pgm = controller + '.imageDropped: ' ;

                // https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
                var reader  = new FileReader();
                reader.addEventListener("load", function () {
                    var image_base64uri = reader.result ;
                    // console.log(pgm + 'reader.result = ' + image_base64uri);
                    var ext = moneyNetworkService.get_image_ext_from_base64uri(image_base64uri);
                    if (!ext) {
                        ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Only png, jpg, jpeg, gif and tif images can be used in chat", 5000]);
                        return;
                    }
                    var max_image_size = moneyNetworkService.get_max_image_size() ;
                    if (image_base64uri.length * 0.75 > max_image_size) {
                        ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Image is too big. Max allowed size is about " + max_image_size + " bytes.", 5000]);
                        return;
                    }

                    self.new_chat_src = image_base64uri ;
                    $scope.$apply() ;

                }, false);
                reader.readAsDataURL($scope.uploadedFile);

            }; // imageDropped

            // input file browse image - todo: refactor
            self.uploadImage = function(event){
                var pgm = controller + '.uploadImage: ' ;
                // what is the target for file upload? new_chat_src in top of page or edit chat message img scr
                var input_file_id = event.target.id ; // file-input, file-input2 or edit_chat_file_input_id_115
                console.log(pgm + 'input_file_id = ' + input_file_id);

                // https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
                var reader  = new FileReader();
                reader.addEventListener("load", function () {
                    var image_base64uri = reader.result ;
                    // console.log(pgm + 'reader.result = ' + image_base64uri);
                    var ext = moneyNetworkService.get_image_ext_from_base64uri(image_base64uri);
                    if (!ext) {
                        ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Only png, jpg, jpeg, gif and tif images can be used in chat", 5000]);
                        return;
                    }
                    var max_image_size = moneyNetworkService.get_max_image_size() ;
                    if (image_base64uri.length * 0.75 > max_image_size) {
                        ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Image is too big. Max allowed size is about " + max_image_size + " bytes.", 5000]);
                        return;
                    }

                    if (['file-input', 'file-input2'].indexOf(input_file_id) != -1) {
                        // image upload in new chat message form
                        self.new_chat_src = image_base64uri ;
                        $scope.$apply() ;
                    }
                    else {
                        // image upload in edit outgoing message (messages ng-repeat section)
                        // now var id = 'edit_chat_file_input_id_' + object_id ;
                        // copy to id = 'edit_chat_msg_img_id_' + object_id ;
                        var input_file_id_array = input_file_id.split('_');
                        var edit_chat_msg_img_id = 'edit_chat_msg_img_id_' + input_file_id_array[input_file_id_array.length-1] ;
                        console.log(pgm + 'edit_chat_msg_img_id = ' + edit_chat_msg_img_id) ;
                        document.getElementById(edit_chat_msg_img_id).src = image_base64uri ;
                        $scope.$apply() ;
                    }

                }, false);
                reader.readAsDataURL(event.target.files[0]);

            }; // uploadImage

            self.new_char_src_remove = function() {
                self.new_chat_src = '' ;
            } ;

            // ChatCtrl
        }])

;