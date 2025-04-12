console.log("Content script loaded for:", window.location.href);

// スクリーンショット要求を送信する関数
async function requestScreenshot() {
  try {
    const result = await chrome.storage.local.get('isEnabled');
    if (result.isEnabled) {
      console.log('Sending screenshot request...');
      chrome.runtime.sendMessage({ type: 'takeScreenshot' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
        } else {
          console.log('Screenshot request sent successfully');
        }
      });
    } else {
      console.log('Extension is disabled, not sending request.');
    }
  } catch (error) {
    console.error('Error requesting screenshot:', error);
  }
}

// クリックイベントのリスナー
document.addEventListener('click', async (event) => {
  const target = event.target;
  const tagName = target.tagName.toUpperCase();

  // 標準的なインタラクティブ要素のタグ名
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
  // インタラクティブ要素内でよく使われるタグ名
  const potentiallyClickableTags = ['IMG', 'SVG', 'I', 'SPAN'];
  // 一般的なインタラクティブなrole属性
  const interactiveRoles = ['button', 'link', 'menuitem', 'checkbox', 'radio', 'tab', 'option'];

  let isConsideredInteractive = false;
  let reason = 'No interactive criteria met';

  // チェック1: ターゲットが標準的なインタラクティブ要素か？
  if (interactiveTags.includes(tagName)) {
    isConsideredInteractive = true;
    reason = `Interactive Tag: ${tagName}`;
  }
  // チェック2: ターゲットがインタラクティブなroleを持っているか？
  else if (target.hasAttribute('role') && interactiveRoles.includes(target.getAttribute('role'))) {
    isConsideredInteractive = true;
    reason = `Interactive Role: ${target.getAttribute('role')}`;
  }
  // チェック3: ターゲットのcomputedスタイルでcursorがpointerか？
  else if (window.getComputedStyle(target).cursor === 'pointer') {
      isConsideredInteractive = true;
      reason = 'Cursor Style: pointer';
  }
  // チェック4: ターゲットがインタラクティブ要素内のクリック可能な要素か（親要素のcursorもチェック）？
  else if (potentiallyClickableTags.includes(tagName) && target.parentElement && window.getComputedStyle(target.parentElement).cursor === 'pointer') {
      isConsideredInteractive = true;
      reason = `Potentially Clickable Tag (${tagName}) inside Parent with Pointer Cursor`;
  }
  // チェック5: ターゲットまたは親要素にonclick属性があるか？
  else if (target.hasAttribute('onclick') || (target.parentElement && target.parentElement.hasAttribute('onclick'))) {
      isConsideredInteractive = true;
      reason = 'onclick attribute found on target or parent';
  }
  // チェック6: ターゲットが編集可能か？
  else if (target.isContentEditable) {
      isConsideredInteractive = true;
      reason = 'contentEditable element';
  }

  if (isConsideredInteractive) {
    console.log(`Click event detected on interactive element (Reason: ${reason}):`, target);
    await requestScreenshot();
  } else {
    console.log('Click event detected on non-interactive element, ignoring:', target);
  }
});

// Enterキーイベントのリスナー
document.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    const target = event.target;
    const tagName = target.tagName.toUpperCase();
    const role = target.getAttribute('role');

    // Enterキーが押される可能性のある一般的な要素かチェック
    const isEnterTarget = ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(tagName) ||
                         (role && ['button', 'link', 'menuitem', 'checkbox', 'radio', 'option'].includes(role)) ||
                         target.isContentEditable;

    if (isEnterTarget) {
      console.log('Enter key detected on interactive element:', target);
      await requestScreenshot();
    } else {
      console.log('Enter key detected, but not on a common interactive element, ignoring:', target);
    }
  }
}); 