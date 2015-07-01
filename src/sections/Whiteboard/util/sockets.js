var find = require('dom-select');
var EVENT = require('../../../model/model').socketEvents;
var SERVERNAME = window.location.origin;
var Cookies = require('cookies-js');

module.exports = function(io, framework, AppState){
  var curSession = window.location.href;
  curSession = curSession.split('/');
  var end = curSession.length -1;
  var curSessionId = curSession[end];
  curSession = '/'+curSession[end - 1] +'/'+ curSession[end];

  var socket = io.connect(SERVERNAME);
  socket.on(EVENT.badSession,function(){
    socket.nsp = '/home';
  });

  socket.emit(EVENT.validateSession,curSessionId);

  socket = io.connect(SERVERNAME +curSession);

  if(Cookies.get('username') != null && Cookies.get('created')!=null){
    socket.emit(EVENT.joinSession,Cookies.get('username'),curSessionId);
  };

  socket.on(EVENT.updateUserList,function(msg,users, curUserIndex) {
    console.log('in update user list');
    var Usertab =  find('.cd-tabs-content li[data-content=Users]');
    var UsertabName = find('a[data-content=Users]');

    UsertabName.innerHTML = 'Users('+msg+')';

    var UserList = find('.userList');
    if(UserList){
      UserList.innerHTML = "";
    }else{
      UserList = document.createElement('div');
      UserList.className = 'userList';
    }
    for(var i = 0; i< users.length; i++){
      var user = document.createElement('div');
      user.className = "user";
      user.innerHTML = users[i].username;

      UserList.appendChild(user);
    }

    AppState.Users.users = users;
    console.log('Current user index: ' + curUserIndex);

    if(curUserIndex !== undefined){
      console.log('Current user set to: ' + users[curUserIndex]);

      AppState.Users.currentUser = users[curUserIndex];
    }

    Usertab.appendChild(UserList);

  });

  socket.on(EVENT.userLeft, function(removedUser) {
    console.log('USER LEFT registered', removedUser);

  })

  socket.on(EVENT.announcement,function(msg){
    //update user list clientside
    //update chat tab with msg
    var Chattab =  find('.chatMessageBox .chatMessages');

    var li = document.createElement('li');
    li.innerHTML = msg;
    Chattab.appendChild(li);
    //adjust all users priority
    //send edited user list to db
  });

  console.log(curSession);
  return socket;

}
