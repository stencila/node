/**
 * Is the user running this process a super user?
 */
module.exports = function isSuperUser () {
  return (process.getuid && process.getuid() === 0) || process.env.SUDO_UID
}
