function ShoppingListCtrl($scope, $route, ShoppingList) {
  
  $scope.shoppingList = ShoppingList.query({senderId:$route.current.params.senderId, circleId:$route.current.params.circleId},
        function() {console.log('shoppingList:', $scope.shoppingList)});
  console.log('ShoppingListCtrl ------------------------------------------');
  
  // TODO duplicated code from GiftCtrl below
  $scope.commasep = function(people) {
    
    if(!angular.isDefined(people)) return "";
    var names = [];
    for(var i=0; i < people.length; ++i) {
      names.push(people[i].fullname);
    }
    return names.join(" and ");
  }
}


function GiftListCtrl($window, $location, $route, $scope, Gift, User, Circle, $rootScope, facebookConnect, $cookieStore) {
  
  
  if(angular.isDefined($route.current.params.circleId)) {
    // 4/10/13: See if $rootScope.circle exists and if its id is the same as $route.current.params.circleId
    if(angular.isDefined($rootScope.circle) && $rootScope.circle.id == $route.current.params.circleId) {
      console.log("GiftListCtrl: no need to re-query for $rootScope.circle...");
      console.log($rootScope.circle);
    }
    else {
      console.log("GiftListCtrl: $rootScope.circle.id != $route.current.params.circleId, so query for the circle using $route.current.params.circleId="+$route.current.params.circleId);
      // circleId parm will have a & on the end that needs to be stripped off when coming to someone's 
      // wish list FROM FACEBOOK.  I set $window.location.search to '' in app.js:run()
      // THIS CODE IS DUPLICATED IN app-GiftCtrl:Gift2Ctrl
      var circleId = $route.current.params.circleId;
      console.log("GiftListCtrl:  BEFORE circleId="+circleId);
      if(circleId.substring(circleId.length - 1) == '&') circleId = circleId.substring(0, circleId.length-1);
      console.log("GiftListCtrl:  AFTER circleId="+circleId);
      $rootScope.circle = Circle.query({circleId:circleId}, function() {console.log("GiftListCtrl: $rootScope.circle....");console.log($rootScope.circle);}, function() {alert("Could not find Event "+circleId);});
    }
    
  }
  else {
    delete $rootScope.circle;
  }
  
  
  
  
  // BEGIN: Check for facebook request id in url.  If it's there, delete it.  The logged in user is the person
  // who received the request.  This is pretty nice clean up of request id's.
  
  // END: Cleaning up facebook request id's.  This may end up getting moved somewhere else, but it's a nice demonstration
  // of how you delete app requests once they've been accepted.
  
  $scope.reminders = function(circle) {
    $rootScope.circle = circle;
    $location.url('/reminders');
  }
  
  $scope.initNewGift = function() {
    console.log("initnewgift() ------------------------");
    console.log($rootScope.circle);
    if(angular.isDefined($rootScope.circle)) {
      $scope.newgift = {addedBy:$rootScope.user, circle:$rootScope.circle};
      $scope.newgift.recipients = angular.copy($rootScope.circle.participants.receivers);
    }
    else {
      $scope.newgift = {addedBy:$rootScope.user};
      $scope.newgift.recipients = [$rootScope.showUser];
    }
    
    for(var i=0; i < $scope.newgift.recipients.length; i++) {
      if($scope.newgift.recipients[i].id == $rootScope.showUser.id)
        $scope.newgift.recipients[i].checked = true;
    }
    
    // you need to specify who the gift is for if there is a circle and if there is more than one receiver in the circle
    $scope.needToSpecifyWhoTheGiftIsFor = angular.isDefined($scope.newgift) && angular.isDefined($scope.newgift.circle) 
           && angular.isDefined($scope.newgift.recipients) && $scope.newgift.recipients.length > 1;
    console.log("scope.needToSpecifyWhoTheGiftIsFor = "+$scope.needToSpecifyWhoTheGiftIsFor);
  }
  
  $scope.updategift = function(index, gift) {
    // the 'showUser' may not be a recipient anymore - have to check and remove from the showUser's list if so
    var remove = true;
    
    for(var i=0; i < gift.possiblerecipients.length; i++) {
      if(gift.possiblerecipients[i].checked) {
        gift.recipients.push(gift.possiblerecipients[i]);
        if(gift.possiblerecipients[i].id == $rootScope.showUser.id) {
          remove = false;
        }
      }
    }
    
    var parms = {giftId:gift.id, updater:$rootScope.user.fullname, description:gift.description, url:gift.url, 
               addedBy:gift.addedBy.id, recipients:gift.recipients, viewerId:$rootScope.user.id, recipientId:$rootScope.showUser.id, 
               senderId:gift.sender, senderName:gift.sender_name};
               
    if(angular.isDefined($rootScope.circle)) parms.circleId = $rootScope.circle.id
    
    var savedgift = Gift.save(parms,
               function() {
                 if(remove) $rootScope.gifts.splice(index, 1);
                 else $rootScope.gifts.splice(index, 1, savedgift);
               });
  }
  
  $scope.addgift = function(gift) {
    // the 'showUser' doesn't have to be a recipient - only add if it is
    var add = false;
    console.log("$scope.addgift:  gift="+gift);
    for(var i=0; i < gift.recipients.length; i++) {
      if(gift.recipients[i].checked && gift.recipients[i].id == $rootScope.showUser.id) {
        add = true;
        //alert(" gift.recipients["+i+"].checked="+gift.recipients[i].checked+"\n gift.recipients["+i+"].id="+gift.recipients[i].id+"\n $rootScope.showUser.id="+$rootScope.showUser.id);
      }
    }
    
    var saveparms = {updater:$rootScope.user.fullname, description:gift.description, url:gift.url, 
               addedBy:gift.addedBy.id, recipients:gift.recipients, viewerId:$rootScope.user.id, recipientId:$rootScope.showUser.id};
    if($rootScope.circle != undefined)
      saveparms.circleId = $rootScope.circle.id;
    
    console.log(saveparms);
    
    var savedgift = Gift.save(saveparms,
               function() {
                 if(add) {$rootScope.gifts.reverse();$rootScope.gifts.push(savedgift);$rootScope.gifts.reverse();}
                 $scope.newgift = {};
                 $scope.newgift.recipients = [];
               });
               
  }  
  
  $rootScope.$on("circlechange", function(event) {
    console.log("GiftListCtrl: circlechange event received --------------------------------");
    $rootScope.gifts = Circle.gifts;
    //$rootScope should be updated by the function that triggered this event
  });
  
  
}

function GiftCtrl($rootScope, $location, $route, $cookieStore, $scope, Circle, Gift, User, GiftEditor) { 


  // Took this out on 2013-09-15.  See "Name is undefined when hovering over Shhh icon.docx"
  // This is the function that makes the cool little bootstrap popover/modal thing that tells the
  // user not to say anything about a particular gift because the recipient doesn't know anything
  // about it.  I discovered that the 'showUser, regardless of whether I used $rootScope.showUser or tried to 
  // pass in $rootScope.showUser as a third 'person' argument
  $scope.surprisePopover = function(gift, fullname) {
    console.log('$scope.surprisePopover: CHECK fullname: ', fullname);
    var cnt = '<table border="0" width="100%">'
             + '<tr><td>Don\'t tell '+fullname+' about this item<P>'+gift.addedByName+' added it as a surprise</P></td></tr>'
             +'</table>';
    return {title:'Shhh !', content:cnt, placement:'right'}
  }

  $scope.changedYourMindPopover = function(idx, gift) {
    var cnt = '<table border="0" width="100%">'
             + '<tr><td>Click Undo if you change your mind and decide not to give this gift</td></tr>'
             +'</table>';
    return {title:'Changed Your Mind?', content:cnt, placement:'right'}
  }
  
  
  // 2013-10-04 copied from user.js on the mobile side - needed to list multiple recipients in viewitem.html when they exist
  $scope.commasep = function(people) {
    
    if(!angular.isDefined(people)) return "";
    var names = [];
    for(var i=0; i < people.length; ++i) {
      names.push(people[i].fullname);
    }
    return names.join(" and ");
  }
  
  
  $rootScope.$on("circlechange", function(event) {
    $rootScope.gifts = Circle.gifts;
    //console.log("GiftCtrl:  notified of 'circlechange'...  $rootScope.gifts=...");
    //console.log($rootScope.gifts);
  });
  
  
  $scope.startbuying = function(gift) {
    gift.buying = true;
    gift.senderId = $rootScope.user.id;
    gift.senderName = $rootScope.user.first;
  }
  
  
  $scope.buygift = function(index, gift, recdate) {
    var circleId = angular.isDefined($rootScope.circle) ? $rootScope.circle.id : -1;
    gift.receivedate = new Date(recdate);
    var savedgift = Gift.save({giftId:gift.id, updater:$rootScope.user.fullname, circleId:circleId, recipients:gift.recipients, viewerId:$rootScope.user.id, recipientId:$rootScope.showUser.id, senderId:gift.senderId, senderName:gift.senderName, receivedate:gift.receivedate.getTime()},
               function() { $rootScope.gifts.splice(index, 1, savedgift); });
  }
  
  
  $scope.returngift = function(index, gift) {
    gift.returning = true; // 4/10/13: replaces the Undo button with a spinner 
    var circleId = angular.isDefined($rootScope.circle) ? $rootScope.circle.id : -1;
    var savedgift = Gift.save({giftId:gift.id, updater:$rootScope.user.fullname, circleId:circleId, recipients:gift.recipients, viewerId:$rootScope.user.id, 
                               recipientId:$rootScope.showUser.id, senderId:-1, senderName:''},
               function() { $rootScope.gifts.splice(index, 1, savedgift); gift.returning = false; });
  }
    
  
  $scope.editgift = function(gift) {
    console.log("$scope.editgift():  rootScope.circle...");
    console.log($rootScope.circle);
    gift.possiblerecipients = angular.isDefined($rootScope.circle) ? angular.copy($rootScope.circle.participants.receivers) : [angular.copy($rootScope.showUser)];
    for(var j=0; j < gift.recipients.length; j++) {
      for(var i=0; i < gift.possiblerecipients.length; i++) {
        if(gift.recipients[j].id == gift.possiblerecipients[i].id)
          gift.possiblerecipients[i].checked = true;
      }
    }
    gift.editing = true;
    $scope.gift = gift;
    GiftEditor.origGift(gift);
  }
  
       
  $scope.canceleditgift = function(gift) {
    console.log("$scope.$parent = ");
    console.log($scope.$parent);
    gift.editing=false;
    var origGift = GiftEditor.reset();
    $scope.gift.description = origGift.description;
    $scope.gift.url = origGift.url;
  }   
  
  
  $scope.deletegift = function(index, gift) {
    $rootScope.gifts.splice(index, 1);
    Gift.delete({giftId:gift.id, updater:$rootScope.user.fullname});
  }
                  
  
  $scope.giftlist = function(circle, participant) {
    
    console.log("$scope.giftlist(): $rootScope.gifts.......commented out stuff");
  
    // We're expanding this to allow for null circle
    // How do we tell if there's no circle?
  
    $rootScope.gifts = Gift.query({viewerId:$rootScope.user.id, circleId:circle.id, recipientId:participant.id}, 
                            function() { 
                              //console.log("scope.giftlist: SETTING path to '/giftlist/#/#/'");
                              //$location.path('/giftlist/'+participant.id+'/'+circle.id);
                              //Circle.gifts = $rootScope.gifts; 
                              //Circle.currentCircle = circle; // phase this strategy out
                              $rootScope.gifts.ready = true;
                              $rootScope.circle = circle;
                              $rootScope.showUser = participant;
                              if($rootScope.user.id == participant.id) { $rootScope.gifts.mylist=true; } else { $rootScope.gifts.mylist=false; } 
                              //$rootScope.$emit("giftlist2");
                              //$rootScope.$emit("circlechange");   // commented out on 11/30/12 - experimenting
                              //$rootScope.$emit("userchange");     // commented out on 11/30/12 - experimenting
                            }, 
                            function() {alert("Hmmm... Had a problem getting "+participant.first+"'s list\n  Try again  (error code 401)");});
  }
}