angular.module('MoneyNetwork')

    .controller('ReactInfoCtrl', ['MoneyNetworkService', '$scope', 'findContactAvatarFilter', '$location', function (moneyNetworkService, $scope, findContactAvatar, $location) {

        var self = this;
        var controller = 'ReactInfoCtrl';
        console.log(controller + ' loaded');

        function debug(key, text) {
            MoneyNetworkHelper.debug(key, text)
        }

        // parameters from click event in reactInfoImg & reactInfoCount .
        // reaction if null if click on total number of reactions in reaction info
        var message = $scope.message;
        var reaction = $scope.reaction;
        // debug('reaction', controller + ': message = ' + JSON.stringify(message));
        // debug('reaction', controller + ': reaction = ' + JSON.stringify(reaction));

        // radio group in top of dialog box - all + radio group for each emoji in reaction info
        self.emojis = [];
        self.emoji = 'All';
        (function () {
            var pgm = controller + '.anonymous function 1: ';
            var sum, i, emoji;
            //reactions = [{
            //    "unicode": "1f603",
            //    "title": "Like",
            //    "src": "https://twemoji.maxcdn.com/2/72x72/1f603.png",
            //    "count": 1,
            //    "$$hashKey": "object:2333"
            //}, {
            //    "unicode": "2764",
            //    "title": "Love",
            //    "src": "https://twemoji.maxcdn.com/2/72x72/2764.png",
            //    "count": 1,
            //    "$$hashKey": "object:2334"
            //}];
            sum = 0;
            for (i = 0; i < message.message.reactions.length; i++) {
                emoji = moneyNetworkService.unicode_to_symbol(message.message.reactions[i].unicode);
                self.emojis.push({
                    emoji: emoji,
                    src: message.message.reactions[i].src,
                    title: message.message.reactions[i].title,
                    count: message.message.reactions[i].count
                });
                sum += message.message.reactions[i].count;
            }
            self.emojis.unshift({
                emoji: 'All',
                src: null,
                title: null,
                count: sum
            });
            if (reaction) self.emoji = moneyNetworkService.unicode_to_symbol(reaction.unicode);
        })();
        // debug('reaction', controller + ': emjois = ' + JSON.stringify(self.emojis));

        // full list of user reactions. From message.message.reaction_info (localStorage) or from like.json file (ZeroNet)
        self.reactions = [];
        (function () {
            var pgm = controller + '.anonymous function 2: ';
            var reaction_info, i, anonymous, unique_id, contact, alias, my_unique_id, setup, emoji, avatar, my_avatar,
                emoji_folders, emoji_folder, src;
            reaction_info = message.message.reaction_info;
            my_unique_id = moneyNetworkService.get_my_unique_id();
            setup = moneyNetworkService.get_user_setup();
            my_avatar = moneyNetworkService.get_avatar();
            emoji_folders = moneyNetworkService.get_emoji_folders() ;
            emoji_folder = setup.emoji_folder || emoji_folders[0] ; // current emoji folder

            if (message.message.z_filename) {
                // public chat. reaction_info from check_public_reaction select.
                if (reaction_info && reaction_info.length) {
                    for (i = 0; i < reaction_info.length; i++) {
                        unique_id = null ;
                        contact = null;
                        alias = 'Unknown' ;
                        avatar = 'public/images/image_failed.gif' ;
                        if (reaction_info[i].count) {
                            anonymous = reaction_info[i].count;
                            unique_id = null;
                            alias = anonymous + ' anonymous reaction' + (anonymous > 1 ? 's' : '');
                            avatar = 'public/images/avatarz.png' ; // anonymous reaction = Z logo
                        }
                        else {
                            unique_id = CryptoJS.SHA256(reaction_info[i].auth_address + '/' + reaction_info[i].pubkey).toString();
                            if (unique_id == my_unique_id) {
                                alias = setup.alias;
                                avatar = my_avatar.src;
                            }
                            else {
                                contact = moneyNetworkService.get_contact_by_unique_id(unique_id);
                                if (!contact) console.log(pgm + 'could not find contact with unique id ' + unique_id);
                                else {
                                    alias = moneyNetworkService.get_contact_name(contact);
                                    avatar = findContactAvatar(contact) ;
                                }
                            }
                        }
                        src = emoji_folder + '/' + moneyNetworkService.symbol_to_unicode(reaction_info[i].emoji) + '.png';
                        self.reactions.push({
                            unique_id: unique_id,
                            contact: contact,
                            alias: alias,
                            avatar: avatar,
                            emoji: reaction_info[i].emoji,
                            src: src
                        });
                    } // for i
                }
            }
            else {
                // private og group chat. message_with_envelope.reaction_info hash
                // console.log(pgm + 'reactions = ' + JSON.stringify(message.message.reactions)) ;
                debug('reaction', pgm + 'reaction_info = ' + JSON.stringify(reaction_info));
                // reaction_info = {"users": {}, "emojis": {"❤": 1, "😮": 1}, "anonymous": {"❤": 1, "😮": 1}};
                if (reaction_info.users) {
                    for (unique_id in reaction_info.users) {
                        contact = null;
                        alias = 'Unknown' ;
                        avatar = 'public/images/image_failed.gif' ;
                        emoji = reaction_info.users[unique_id];
                        // debug('reaction', pgm + 'unique_id = ' + unique_id + ', emoji = ' + JSON.stringify(emoji)) ;
                        if (unique_id == my_unique_id) {
                            if ((message.contact.type == 'group') &&
                                (message.message.folder == 'inbox') &&
                                (typeof emoji == 'object')) continue; // also in anonymous reactions
                            alias = setup.alias || 'Me';
                            avatar = my_avatar.src ;
                        }
                        else {
                            contact = moneyNetworkService.get_contact_by_unique_id(unique_id);
                            if (!contact) console.log(pgm + 'could not find contact with unique id ' + unique_id);
                            else {
                                alias = moneyNetworkService.get_contact_name(contact);
                                avatar = findContactAvatar(contact) ;
                            }
                        }
                        if (emoji && (typeof emoji == 'object')) emoji = emoji[0]; // private reaction
                        src = emoji_folder + '/' + moneyNetworkService.symbol_to_unicode(emoji) + '.png' ;
                        self.reactions.push({
                            unique_id: unique_id,
                            contact: contact,
                            alias: alias,
                            avatar: avatar,
                            emoji: emoji,
                            src: src
                        });
                    } // for
                }
                if (reaction_info.anonymous) {
                    for (emoji in reaction_info.anonymous) {
                        anonymous = reaction_info.anonymous[emoji];
                        alias = anonymous + ' anonymous reaction' + (anonymous > 1 ? 's' : '');
                        src = emoji_folder + '/' + moneyNetworkService.symbol_to_unicode(emoji) + '.png';
                        self.reactions.push({
                            unique_id: null,
                            contact: null,
                            alias: alias,
                            avatar: 'public/images/avatarz.png', // anonymous reaction = Z logo
                            emoji: emoji,
                            src: src
                        });
                    }
                }
            }
        })();
        // debug('reaction', controller + ': reactions = ' + JSON.stringify(self.reactions));

        self.filter_reactions = function (reaction, index, reactions) {
            var pgm = controller + '.filter_reactions: ';
            return ((self.emoji == 'All') || (reaction.emoji == self.emoji)) ;
        }; // filter_reactions

        self.infinite_scroll_limit = 20 ;
        function add_test_data () {
            var pgm = controller + '.add_test_data: ';
            var reaction ;
            while (self.reactions.length < self.infinite_scroll_limit) {
                reaction = {
                    unique_id: null,
                    contact: null,
                    alias: MoneyNetworkHelper.generate_random_password(10),
                    avatar: self.reactions[0].avatar,
                    src: self.reactions[0].src
                } ;
                self.reactions.push(reaction) ;
            } // while
        }
        // add_test_data() ;
        self.get_more_reactions = function () {
            var pgm = controller + '.get_more_reactions: ' ;
            self.infinite_scroll_limit += 20 ;
            debug('reaction || infinite_scroll', pgm + 'infinite_scroll_limit = ' + self.infinite_scroll_limit) ;
            // add_test_data() ;
        }; // get_more_reactions

        self.chat_contact = function (contact) {
            var pgm = controller + '.chat_contact: ' ;
            var a_path, z_path ;
            if (!contact) return ;
            // console.log(pgm + 'contact = ' + JSON.stringify(contact)) ;
            // notification if starting chat with an older contact (Last online) or an old guest account
            if (moneyNetworkService.is_old_contact(contact)) a_path = '/chat2/' + contact.unique_id ;
            else a_path = '/chat2/' + contact.cert_user_id ;
            z_path = "?path=" + a_path ;
            $location.path(a_path);
            $location.replace();
            ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "Chat", z_path]) ;
            $scope.closeThisDialog('x');
        } ; // chat_contact

        // ReactInfoCtrl
    }])

;
