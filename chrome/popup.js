/*
 Copyright (C) 2017-present  John Berlin <n0tan3rd@gmail.com>
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function check () {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.runtime.sendMessage(
        { wbpp: 'isWorking', tab: tabs[0] },
        response => {
          resolve(response)
        }
      )
    })
  })
}

function sendMessage (tab, message) {
  chrome.runtime.sendMessage(
    { wbpp: message, id: tab.id, url: tab.url },
    function (response) {}
  )
}

window.onload = async function () {
  const response = await check()
  const buttonContainer = document.getElementById('buttonContainer')
  if (!buttonContainer) {
    return
  }
  const caButtonDOM = document.createElement('input')
  caButtonDOM.type = 'button'
  caButtonDOM.id = 'doIt'
  if (!response.isWorking) {
    caButtonDOM.value = 'See What Page Looks Like With Client Side Rewriting'
    caButtonDOM.onclick = function () {
      console.log('not working')
      sendMessage(response.tab, 'start')
    }
  } else {
    caButtonDOM.value = 'Stop'
    caButtonDOM.onclick = function () {
      console.log('stopping')
      sendMessage(response.tab, 'stop')
    }
  }
  buttonContainer.appendChild(caButtonDOM)
}

// http://web.archive.org/web/20171212213803/https://www.nbcnews.com/
// http://web.archive.org/web/20170717091032/https://www.spiegel.com/
