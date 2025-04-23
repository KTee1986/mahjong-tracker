/********************************************************************
* This is a module written in nodjs from a Wix backend.
* It performs a logon in Settle Up (https://settleup.io/) and
* it checks the parameters that it receives
*   - Group
*   - Member names
* and it returns the firebase token and applications technical id's
* that are needed to create transactions, which is done elsewhere
*********************************************************************/
import firebase from 'firebase';
import axios from 'axios';
import { getSecret } from 'wix-secrets-backend';

var environment; //live OR sandbox
var app = null;

var userTokedId;
var url;
var firebaseConfig;

const sandboxFirebaseConfig = {
  apiKey: "AIzaSyCfMEZut1bOgu9d1NHrJiZ7ruRdzfKEHbk",
  authDomain: "settle-up-sandbox.firebaseapp.com",
  databaseURL: "https://settle-up-sandbox.firebaseio.com",
  projectId: "settle-up-sandbox",
  storageBucket: "settle-up-sandbox.appspot.com",
  appId: "327675517252504"  
}

const liveFirebaseConfig = { /* see contact on https://settleup.io/api.html for live credentials */
  apiKey: "AIzaSyCfMEZut1bOgu9d1NHrJiZ7ruRdzfKEHbk",
  authDomain: "settle-up-sandbox.firebaseapp.com",
  databaseURL: "https://settle-up-sandbox.firebaseio.com",
  projectId: "settle-up-sandbox",
  storageBucket: "settle-up-sandbox.appspot.com",
  appId: "327675517252504" 
}

var options = {
    headers: {
    "Content-Type": "application/json",			
    },
    body: {
    "uid" :"",
    "token": "",
    "groupid": "",
    "memberids": [],
    "url_env" : "",		
    "error": "Internal server error"
    }
}

export async function settleupLogin(request)
{
  

  /*-------------------------------------
  *
  *   INIT FIREBASE, AUTHENTICATION (LOGIN)
  *
  *-------------------------------------*/
  userTokedId = null;
	let uid = null;
	await initFirebase(request.query.env, function ( err, idtoken, userUid)
	{
		userTokedId = idtoken;
		uid = userUid;
		options.body.error = null;
	});
	do {
		await sleep(1000);
	} while (!userTokedId);
	options.body.uid = uid;
	options.body.token = userTokedId;
  options.body.url_env = firebaseConfig.databaseURL;

  /*-------------------------------------
  *
  *   GET GROUPS OF ACTIVE USERS
  *
  *-------------------------------------*/
    
	let groups = await getUserGroups(uid);

  /*-------------------------------------
  *
  *   SEARCH QUERY GROUPNAME CASE INSENSITIVE 
  *   VALIDATION IN ACTIVE USERGROUPS 
  *   RETURN ID 
  *
  *-------------------------------------*/
    
  let groupId = await findGroupId(request.query.groupname, groups)
  if (!groupId)
  {
    options.body.error = "Group with name '" + request.query.groupname + "' not found!";
    return options;
  }
  options.body.groupid = groupId;

  /*-------------------------------------
  *
  *   SEARCH QUERY MEMBERNAMES IN GROUP
  *   GROUP = QUERY GROUPNAME
  *
  *-------------------------------------*/

  let jsonstring = '{"names": ' + request.query.membernames + '}';
  let memberNames = JSON.parse(jsonstring);
  let memberId;
  for (var i = 0; i < memberNames.names.length; i++) {    
    memberId = await findMemberId(memberNames.names[i], groupId, false);  
    if (!memberId)
    {
      options.body.error = "Member with name '" + memberNames.names[i] + "' not found!";
      return options;
    }
    options.body.memberids.push(memberId);
  }

/*-------------------------------------
  *
  *   END OF VALIDATIONS
  *   RETURN ID's AND TOKEN FOR CREATION
  *
  *-------------------------------------*/

  return options;

}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}   

async function initFirebase(env, callback) {
  
  if (!env) {environment = "sandbox"}
  else {
    if ((env === "sandbox") || (env === "live")) {
      environment = env;
    } else {
      environment = "sandbox";
    }
  }

  if (environment === "live") {
    firebaseConfig = liveFirebaseConfig;
  } else  {
    firebaseConfig = sandboxFirebaseConfig;
  }
  //Login with predefined username and password from wix backend service 'secrets'. You also can pass it in your request.
	if (!app) {app = firebase.initializeApp(firebaseConfig);}
  	firebase.auth().signInWithEmailAndPassword(await getSecret("SettleUpUsername"),await getSecret("SettleUpPassword")).catch(function(error) {
		// Handle Errors here.
		var errorCode = error.code;
		var errorMessage = error.message;
		console.error("Error in login " + errorCode + " / " + errorMessage);
  });
	
	firebase.auth().onAuthStateChanged(async function(isUser) {
		if (isUser) {
			// User is signed in.
			let user = await firebase.auth().currentUser;
			let idtoken = await user.getIdToken();
			//console.log("Firebase user loggged in: " + user.email);			
			return callback(null, idtoken, user.uid); 	
		}
  });
  
}

async function findGroupId(groupName, userGroups) {
  for (var groupId in userGroups) {
    if (groupName.toUpperCase() === (await getGroupDetails(groupId)).name.toUpperCase()) {
      return groupId;
    }
  }  
  return null;
}

async function getGroupDetails(groupId) {
  url = firebaseConfig.databaseURL + "/groups/" + groupId + ".json?auth=" + userTokedId;
  try {
    const response = await axios.get(url);
    const data = response.data;
   return data;
  } catch (error) {
    options.body.error = JSON.stringify(error);
    return null;
  }
}

// this function also enables the member if disabled
async function findMemberId(memberName, groupid, createIfNotFound=false) {
  memberName = prepareForSettleUp_memberName(memberName);
  const groupMembers = await getGroupMembers(groupid);
  for (var memberId in groupMembers) {
    if (memberName.toUpperCase() === groupMembers[memberId].name.toUpperCase()) {
      const member = groupMembers[memberId];
      if (member.active === false) {
        await putMemberActive(groupMembers, groupid, memberId, true /*active*/);
      }
      return memberId;
    }
  }
  if (createIfNotFound) {
    // retry with a delay once again, maybe the member was not added yet! (as it's the case in my testing)
    console.error("Member '" + memberName + "' not found, creating him now on SettleUp!");

    // returns the memberId
    return (await postMember(memberName, groupid)).name;
  }
  // we have tried to retry, friend :/
  console.error("Member " + memberName + "not found!");
  return null;
}

// limit stands for max length
// these are the limits of Settle Up
const LIMIT_MEMBER_NAME = 20;
const LIMIT_TX_NAME = 128;
// this means that after 99999 installments it might throw an error of max Tx length
const LIMIT_N_OF_INSTALLMENTS = 5;
const LIMIT_PROD_NAME = LIMIT_TX_NAME - 1 - LIMIT_N_OF_INSTALLMENTS - 1 - LIMIT_MEMBER_NAME;

function prepareForSettleUp_memberName(memberName) {
  if (memberName.length <= LIMIT_MEMBER_NAME) {
    return memberName;
  } else {   
    options.body.error = 'memberName too long' + memberName + ">" + memberName.substring(0, LIMIT_PROD_NAME - 2) + '..';    
    return memberName.substring(0, LIMIT_MEMBER_NAME - 2) + '..';
  }
}
/*
function prepareForSettleUp_prodName(prodName) {
  if (prodName.length <= LIMIT_PROD_NAME) {
    return prodName;
  } else {
    // this is the normal transaction on settle up.
    // the minus 2 is to substitute with '..' if the product name is too long
    // so for example "Product Name is very looooo.. 43210 Giovanni Pietro De.."
    console.error('prodName too long');
    console.error(prodName);
    console.error(prodName.substring(0, LIMIT_PROD_NAME - 2) + '..');
    return prodName.substring(0, LIMIT_PROD_NAME - 2) + '..';
  }
}*/

async function getUserGroups(uid) {
  url = firebaseConfig.databaseURL + "/userGroups/" + uid + ".json?auth=" + userTokedId;
  try {
    const response = await axios.get(url);
    const data = response.data;
    return data;
  } catch (error) {
    options.body.error = JSON.stringify(error);
    return null;
  }
}
async function getGroupMembers(groupid) {
  url = firebaseConfig.databaseURL + "/members/"+ groupid + ".json?auth=" + userTokedId;
  try {
    const response = await axios.get(url);
    const data = response.data;
    return data;
  } catch (error) {
    options.body.error = JSON.stringify(error);
    return null;
  }
}

async function putMemberActive(groupMembers, groupId, memberId, active=true) {
  url = firebaseConfig.databaseURL + "/members/" + groupId + ".json?auth=" + userTokedId;
  const json = groupMembers;
  json[memberId].active = active;
  try {
    const response = await axios.put(url, json);
    const data = response.data;
   return data;
  } catch (error) {
    options.body.error = JSON.stringify(error);
    return null;
  }
}

async function postMember(memberName, groupid) {
  url = firebaseConfig.databaseURL + "/members/" + groupid + ".json?auth=" + userTokedId;
  const json = {
    'active': true,
    'defaultWeight': '1',
    'name': memberName
  }
  try {
    const response = await axios.post(url, json);
    const data = response.data;
   return data;
  } catch (error) {    
    options.body.error = JSON.stringify(error);
    return null;
  }  
}