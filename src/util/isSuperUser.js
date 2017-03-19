/**
 * Is the user running this process a super user?
 *
 * @memberof util
 */
function isSuperUser () {
  return (process.getuid && process.getuid() === 0) || process.env.SUDO_UID
}

module.exports = isSuperUser
