/* vim: sw=2 ts=2 sts=2 et filetype=javascript 
 * 
 * Implement the mozIStorageVacuumParticipant to let smilefox.sqlite to be vacuumed every 1 or 2 months.
 *
 * Modified from the unit test code for Bug 541373, which is under Public Domain / CC0:
 * http://mxr.mozilla.org/mozilla-central/source/storage/test/unit/vacuumParticipant.js
*/

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

/* Contstructor. Assign smilefox.sqlite as the database to vacuum. */
function NicoFoxVacuumParticipant()
{
  Components.utils.import("resource://nicofox/Services.jsm");
  var file = Services.dirsvc.get("ProfD", Ci.nsIFile);
  file.append("smilefox.sqlite");
  this._dbConn = Services.storage.openDatabase(file);
}

NicoFoxVacuumParticipant.prototype =
{
  classDescription: "Vacuum participant for NicoFox",
  classID: Components.ID("{c4468b7d-b273-4f0a-a729-3397022ab9c8}"),
  contractID: "@littleb.tc/nicofox-vacuum-participant;1",

  get expectedDatabasePageSize() Ci.mozIStorageConnection.DEFAULT_PAGE_SIZE,
  get databaseConnection() this._dbConn,

  onBeginVacuum: function()
  {
    Components.utils.reportError("VACUUM on smilefox.sqlite start!");
    return true;
  },
  onEndVacuum: function(aSucceeded)
  {
    if (aSucceeded) {
      Components.utils.reportError("VACUUM on smilefox.sqlite succeeded!");
    } else {
      Components.utils.reportError("VACUUM on smilefox.sqlite failed!");
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.mozIStorageVacuumParticipant])
};

/* Only enable this component on Firefox 4 with mozIStorageVacuumParticipant */
if (XPCOMUtils.generateNSGetFactory && Ci.mozIStorageVacuumParticipant) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory([NicoFoxVacuumParticipant]);
}
