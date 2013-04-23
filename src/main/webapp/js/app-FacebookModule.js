
// delete app requests: http://developers.facebook.com/docs/requests/#deleting
// source:  http://jsfiddle.net/mkotsur/Hxbqd/
angular.module('FacebookModule', ['UserModule']).factory('facebookConnect', [function() {
    return new function() {
        this.askFacebookForAuthentication = function(fail, success) {
            console.log("askFacebookForAuthentication:  FB...");
            console.log(FB);
            FB.login(function(response) {
                if (response.authResponse) {
                    FB.api('/me', success);
                } else {
                    fail('User cancelled login or did not fully authorize.');
                }
            }, {scope:'email',perms:'publish_stream'});
        }
        
        this.getLoginStatus = function(connected, notauthorized, unknown) {
          if(FB == undefined) console.log("this.getLoginStatus:  FB == undefined");
          if(FB === undefined) console.log("this.getLoginStatus:  FB === undefined");
          FB.getLoginStatus(function(response) {
            if(response.status == 'connected') {
              connected(response);
            }
            else if(response.status == 'not_authorized') {
              notauthorized(response);
            }
            else {
              unknown(response);
            }
          });
          console.log("this.getLoginStatus: NNNNNNNNNNNNNNNNNNNNNNNN");
        }
        
        this.deleteAppRequest = function(requestId) {
          console.log("this.deleteAppRequest:  BEGIN:  requestId="+requestId+",  FB="+FB);
          FB.getLoginStatus(function(response) {
            if(response.status == 'connected') {
              console.log("this.deleteAppRequest:  connected...");
              FB.api(requestId, 'delete', function(resp2) {
                console.log("this.deleteAppRequest:  resp2...");
                console.log(resp2);
              });
            }
            else  {
              console.log("this.deleteAppRequest:  not connected...");
            }
            
          });
          
        }
        
        this.logout = function(response) {
          console.log("this.logout = function(response) ----------------");
          
        }
        
    } // return new function()
    
}])
.factory('facebookFriends', function() {
  return new function() {
    this.getfriends = function(offset, limit, fail, success) {
      var url = '/me/friends?offset='+offset+'&limit='+limit;
      console.log("facebookFriends.getfriends():  url="+url);
      FB.api(url, success);
    }
  }
}).run(function($rootScope, $window, $cookieStore, $location, facebookConnect, AppRequest, UserSearch, User) {
    
    $rootScope.acceptAppRequest = function($window, facebookConnect) {
      
      var facebookreqids = [];
      console.log(facebookreqids);
      
      console.log("$cookieStore.get(window.location.search) = "+$cookieStore.get("window.location.search"));
      
      if($cookieStore.get("window.location.search")==null) {
        console.log("$rootScope.acceptAppRequest:  RETURN EARLY:  cookieStore.get(window.location.search) is null");
        return;
      }
      
      var parms = $cookieStore.get("window.location.search").split("&")
      
      console.log("TRY SET $window.location.search = ''");
      $window.location.search = '';
      
      if(parms.length > 0) {
        for(var i=0; i < parms.length; i++) {
          if(parms[i].split("=").length > 1 && (parms[i].split("=")[0] == 'request_ids' || parms[i].split("=")[0] == '?request_ids')) {
            fbreqids_csv = parms[i].split("=")[1].split("%2C")
            for(var j=0; j < fbreqids_csv.length; j++) {
              facebookreqids.push(fbreqids_csv[j]);
            }  
          }
        }
      }  
  
      for(var k=0; k < facebookreqids.length; k++) {
        console.log("facebookreqids["+k+"] = "+facebookreqids[k]);
      }
    
      if(facebookreqids.length > 0) {
        deleterequests = function(res) {
          console.log("app.js:  about to delete app requests.  res = ...");
          var fbid = res.authResponse.userID;
          console.log(res);
          for(var i=0; i < facebookreqids.length; i++) {
            var reqid_plus_fbid = facebookreqids[i]+'_'+fbid;
            console.log("app.js: deleting app request: "+reqid_plus_fbid);
            facebookConnect.deleteAppRequest(reqid_plus_fbid);
          }
          
          // get the user info of the person who just accepted the app request
          // and write this to the db
          FB.api('/me', function(meresponse) {
            $rootScope.fbuser = angular.copy(meresponse);
            console.log("app.js:  meresponse..."); // will have: name, email, first_name, last_name, id, and other stuff
            console.log(meresponse);
            // queries person table for everyone that has either facebook id or email
            records = AppRequestAccepted.save({facebookId:meresponse.id, email:meresponse.email, name:meresponse.name, fbreqids:fbreqids_csv}, 
              function() {
                // 'records' should always have at least one element because fbinvite() will write a record with the given facebook id if no facebook id is found
                if(records.length == 1) { 
                  $rootScope.user = angular.copy(records[0]);
                  $rootScope.showUser = angular.copy(records[0]); 
                  console.log("$rootScope.acceptAppRequest:  $rootScope.user = angular.copy(records[0]); ----------------------------------");
                  console.log("$rootScope.acceptAppRequest:  EMIT USERCHANGE ----------------------------------");
                  console.log("$rootScope.acceptAppRequest:  SET USERID COOKIE $rootScope.user.id="+$rootScope.user.id+"  ----------------------------------");
                  console.log("$rootScope.acceptAppRequest:  $rootScope.user .....................");
                  console.log($rootScope.user);
                  $cookieStore.put("user", $rootScope.user.id);
                  $cookieStore.put("showUser", $rootScope.showUser.id);
                  //$rootScope.$emit("userchange"); // commented out on 11/30/12 - experimenting
                  console.log("$rootScope.acceptAppRequest:  GO EXPLICITLY TO MYWISHLIST PAGE");
                  $location.url('mywishlist');
                }
                else if(records.length > 1) {
                  // go to the "who are you" page
                  User.multipleUsers = records;
                  $location.url('whoareyou');
                }
              },
              function() {alert("Couldn't get user id (error 111)");});
          });
          
        }
        notauthorized = function(res) { console.log("app.js: FB: not authorized"); }
        unknown = function(res) { console.log("app.js: FB: unknown"); }
        facebookConnect.getLoginStatus(deleterequests, notauthorized, unknown);
      }
      
      $cookieStore.remove("window.location.search");
      
    } // end $rootScope.acceptAppRequest()
    
    
    // 3/12/13 This function will actually log the user out of Facebook - not sure if this really what we want to do.
    // Other sites don't behave this way, even when you login via fb.
    $rootScope.fblogout = function() {
      $cookieStore.remove("user");
      $cookieStore.remove("showUser");
      if(!angular.isDefined($rootScope.user.facebookId) || $rootScope.user.facebookId==null) {
        console.log("user's facebook id is undefined - returning early - don't try FB.logout()");
        $location.url('home');
        return;
      }
      console.log("$rootScope.user.facebookId="+$rootScope.user.facebookId+" - therefore we ARE going to do FB.logout()");
      console.log("FB.logout ---------------- FB = ...");
      console.log(FB);
      FB.logout(function(response){
        console.log("FB.logout:  response...");
        console.log(response);
        $location.url('home');
      });
    }
    
    $rootScope.fbinviteasfriend = function() { $rootScope.fbinvite(false, ''); }
    
    $rootScope.fbinviteasgiver = function() { $rootScope.fbinvite(true, 'Giver'); }
    
    $rootScope.fbinviteasreceiver = function() { $rootScope.fbinvite(true, 'Receiver'); }

    
    // This isn't meant to be called from a page, it's meant to be called by 1 of the 3 functions above
    $rootScope.fbinvite = function(includeinevent, participationlevel) {
      FB.ui({method: 'apprequests', message: 'Check out LittleBlueBird.  You can post your Christmas and birthday lists on it.  It\'s totally awesome!  No more emailing lists back and forth.  No more getting two of something.'}, 
            function callback(appresponse) {
              // appresponse.to:  an array of fb id's
              // appresponse.request:  the request id returned by fb
              console.log("$rootScope.fbinvite:  appresponse...");
              console.log(appresponse);
              console.log("$rootScope.fbinvite:  $rootScope.user.id="+$rootScope.user.id);
              
              FB.api('/me/friends', function(friendresponse) {
                if(friendresponse.data) {
                  console.log("FB.api(/me/friends):  friendresponse.data...");
                  //console.log(friendresponse.data);
                  // loop through all facebook id's to figure out the names that go with the facebook id's of people that just got app requests
                  var apprequests = [];
                  
                  for(var i=0; i < appresponse.to.length; i++) {
                    for(var j=0; j < friendresponse.data.length; j++) {
                      if(appresponse.to[i] == friendresponse.data[j].id) {
                        apprequests.push({parentId:$rootScope.user.id, fbreqid:appresponse.request, facebookId:appresponse.to[i], name:friendresponse.data[j].name});
                        console.log("FOUND FRIEND NAME: fbid="+appresponse.to[i]+", name="+friendresponse.data[j].name+", fbreqid="+appresponse.request);
                        break;
                      }
                    }
                  }
                  
                  var circlestuff = {};
                  if(includeinevent) {
                    circlestuff.circleId = $rootScope.circle.id;
                    circlestuff.participationlevel = participationlevel;
                  }
                  
                  console.log("WRITING THESE AppRequests...");
                  console.log(apprequests);
                  var stuff = AppRequest.save({requests:apprequests, circlestuff:circlestuff},
                          function() {
                            console.log("$rootScope.fbinvite() ------------------------------");
                            console.log(stuff);
                            $rootScope.user.friends = stuff.friends;
                            $rootScope.$emit("friends"); 
                            
                            if(angular.isDefined($rootScope.circle) && angular.isDefined(stuff.participants)) {
                              $rootScope.circle.participants = stuff.participants;
                            }
                            
                            //$rootScope.$apply();
                          });
                  
                } else {
                  console.log("FB.api(/me/friends):  ERROR: friendresponse...");
                  console.log(friendresponse);
                }
              });
              
            });
    }   
    
    
    $rootScope.registerWithFacebook = function() {
        facebookConnect.askFacebookForAuthentication(
          function(reason) { // fail
            $rootScope.error = reason;
            console.log("Facebook Module:  $rootScope.registerWithFacebook:  reason="+reason);
          }, 
          function(user) { // success
            console.log("app-FacebookModule.js:  $rootScope.registerWithFacebook:  success...");
            $rootScope.initfbuser(user);
            //$rootScope.$apply() // Manual scope evaluation - commented out on 11/30/12 - experimenting
          }
        );
    } 
    
    
    // can also supply a "to" argument with value of someone's facebook id whose wall/timeline you want to post on
    // but beware, that person may not allow that
    $rootScope.fbsharelist = function(showUser) {
      FB.ui({
          method:'feed',
          name:'I\'ve updated my wish list. Check it out on LittleBlueBird.com [FREE for all subscribers]',
          caption:'Give what THEY want - Get what YOU want',
          description:'This is the site my friends and family use to keep track of everyone\'s wish list',
          link:'http://www.littlebluebird.com/gf/giftlist/'+showUser.id+'/',
          picture:'http://www.littlebluebird.com/giftfairy/img/logo.gif',
          //actions: [{name:'actions:name?', link:'http://www.littlebluebird.com/foo/'}],
          user_message_prompt:'user message prompt?'},
        function(response) {
          if(response && response.post_id) {
            console.log('$rootScope.fbsharelist():  post was successful');
          }
          else {
            console.log('$rootScope.fbsharelist():  post was not published');
          }
        });
    }
    
    $rootScope.initfbuser = function(user) {
      $rootScope.fbuser = user;
      console.log("$rootScope.initfbuser...");
      console.log($rootScope.fbuser);
      
      // could get more than one person back - parent + children
      // So this method allows for the fact that the user may have an LBB account that has not yet
      // been "merged" with the FB account.  That's why we're querying by email and not fb id: because person.facebook_id
      // may be null
      // UserSearch.query DOESN'T TAKE A LOGIN:TRUE PARAMETER
      $rootScope.users = UserSearch.query({login:true, search:$rootScope.fbuser.email}, 
                    function() {
                      console.log("$rootScope.initfbuser:  var users = UserSearch.query(): $rootScope.users...");
                      console.log($rootScope.users);
                      var alreadymergedaccount = false;
                      for(var i=0; i < $rootScope.users.length; i++) {
                        if($rootScope.users[i].facebookId == $rootScope.fbuser.id) {
                          alreadymergedaccount = true;
                          $rootScope.user = angular.copy($rootScope.users[i]);
                          $rootScope.showUser = angular.copy($rootScope.users[i]);
                          $cookieStore.put("user", $rootScope.user.id);
                          $cookieStore.put("showUser", $rootScope.showUser.id);
                        }
                      }
                      console.log("$rootScope.initfbuser():  $rootScope.user="+$rootScope.user);
                      if(alreadymergedaccount) {
                        console.log("app-FacebookModule:  this is already a merged account, so going now to mywishlist");
                        $location.url('me');
                      } 
                      else { // ...but in the beginning, this is what will happen - no record in our person table contains this facebookId
                        if($rootScope.users.length == 0) {
                           // need to create account for this person in LBB
                                                       
                           $rootScope.user = User.save({login:true, fullname:$rootScope.fbuser.first_name+' '+$rootScope.fbuser.last_name, first:$rootScope.fbuser.first_name, last:$rootScope.fbuser.last_name, username:$rootScope.fbuser.email, email:$rootScope.fbuser.email, password:$rootScope.fbuser.email, bio:'', profilepic:'http://graph.facebook.com/'+$rootScope.fbuser.id+'/picture?type=large', facebookId:$rootScope.fbuser.id}, 
                                               function() { 
                                                 $rootScope.showUser = angular.copy($rootScope.user);
                                                 $cookieStore.put("user", $rootScope.user.id);
                                                 $cookieStore.put("showUser", $rootScope.showUser.id);
                                                 console.log("just created an LBB account, check $rootScope.user...");
                                                 console.log($rootScope.user);
                                                 
                                                 //console.log("$rootScope.initfbuser:  $rootScope.$emit(\"userchange\")");
                                                 //$rootScope.$emit("userchange"); 
                                                 
                                                 //console.log("$rootScope.initfbuser:  $rootScope.$broadcast(\"userchange\")");
                                                 //$rootScope.$broadcast("userchange");   
                                                                                        
                                                 //$rootScope.$emit("mywishlist");  // commented out on 11/30/12 - experimenting
                                                 console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
                                                 $location.url('welcome');
                                               }
                                             );
                        }
                        else if($rootScope.users.length == 1) {  // easy... we found exactly one person with this email - set the facebookid
                          $rootScope.users[0].facebookId = $rootScope.fbuser.id;
                          $rootScope.user = angular.copy($rootScope.users[0]);
                          $rootScope.showUser = angular.copy($rootScope.users[0]);
                          $cookieStore.put("user", $rootScope.user.id);
                          $cookieStore.put("showUser", $rootScope.showUser.id);
                          console.log("$rootScope.users.length == 1:  $rootScope.users[0].profilepicUrl...");
                          console.log($rootScope.users[0].profilepicUrl);
                          var placeholderPic = "http://sphotos.xx.fbcdn.net/hphotos-snc6/155781_125349424193474_1654655_n.jpg";
                                                         
                          console.log("$rootScope.users[0].profilepicUrl != placeholderPic...");
                          console.log($rootScope.users[0].profilepicUrl != placeholderPic);
                                                         
                          var pic = $rootScope.users[0].profilepicUrl != placeholderPic ? $rootScope.users[0].profilepicUrl : "http://graph.facebook.com/"+$rootScope.fbuser.id+"/picture?type=large";
                          var uagain = User.save({userId:$rootScope.user.id, facebookId:$rootScope.fbuser.id, profilepic:pic}, 
                                       function() {
                                         $rootScope.user = angular.copy(uagain); 
                                         $rootScope.showUser = angular.copy(uagain);
									     //$rootScope.$emit("userchange"); // commented out on 11/30/12 - experimenting                                       
									     //$rootScope.$emit("mywishlist"); // commented out on 11/30/12 - experimenting
                                         console.log("444444444444444444444444444444444444444");
									     $location.url('mywishlist');});
                                       }
                        else if($rootScope.users.length > 1) {
                          // And if we happen to find several people all with the same email address and no FB id,
                          // we have to ask the user "who are you" and display all the people that have this email address
                          // "Why are you asking me?"... "What is a 'merged' account?"...  "Why do I need to 'merge' my accounts?"...
                          // These are all things we have to explain to the user on the mergeaccount page
                          $location.url('/whoareyou'); 
                        }
                      }
                    },
                    function() {alert("Could not log you in at this time (error 201)");});
    
    }
    

  });