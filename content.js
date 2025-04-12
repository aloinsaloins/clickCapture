console.log("Content script loaded for:", window.location.href);

// スクリーンショット要求を送信する関数
// options オブジェクトを受け取るように変更 (例: { captureImmediate: true })
async function requestScreenshot(options = {}) {
  try {
    console.log('Requesting settings check from background...');
    const settingsResponse = await chrome.runtime.sendMessage({ type: 'checkSettings' });
    console.log('Received settings response:', settingsResponse);

    if (settingsResponse && settingsResponse.isAllowed) {
      console.log(`Site is allowed. Sending takeScreenshot request (options: ${JSON.stringify(options)})...`);
      // background.js に options を渡す
      chrome.runtime.sendMessage({ type: 'takeScreenshot', options: options });
      console.log('takeScreenshot request sent.');
    } else {
      console.log(`Screenshot request denied or check failed. Response: ${JSON.stringify(settingsResponse)}`);
    }
  } catch (error) {
    console.error('Error requesting screenshot:', error);
    if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
    }
  }
}

// 要素またはその祖先がインタラクティブかチェックする関数
function isElementOrAncestorInteractive(element, levels = 3) {
  console.log('[InteractiveCheck] Starting check for element:', element);
  let current = element;
  for (let i = 0; i < levels && current && current !== document.body && current !== document.documentElement; i++) {
    const tagName = current.tagName.toUpperCase();
    const role = current.getAttribute('role');
    const onclickAttr = current.hasAttribute('onclick');
    const isEditable = current.isContentEditable;
    const classList = current.classList;
    let cursorStyle = 'unknown';
    try {
      cursorStyle = window.getComputedStyle(current).cursor;
    } catch (e) {
      console.warn('[InteractiveCheck] Could not get computed style for element:', current, e);
    }

    console.log(`[InteractiveCheck] Checking level ${i}, Element: <${tagName}>`, { role, onclick: onclickAttr, isEditable, cursor: cursorStyle, classes: classList }, current);

    // 標準的なインタラクティブ要素のタグ名
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
    // 一般的なインタラクティブなrole属性
    const interactiveRoles = ['button', 'link', 'menuitem', 'checkbox', 'radio', 'tab', 'option'];

    // チェック1: タグ名
    if (interactiveTags.includes(tagName)) {
      console.log('[InteractiveCheck] Result: TRUE (Interactive Tag)');
      return { interactive: true, reason: `Interactive Tag (${tagName}) found in hierarchy` };
    }
    // チェック2: Role属性
    if (role && interactiveRoles.includes(role)) {
      console.log('[InteractiveCheck] Result: TRUE (Interactive Role)');
      return { interactive: true, reason: `Interactive Role (${role}) found in hierarchy` };
    }
    // チェック3: onclick属性
    if (onclickAttr) {
      console.log('[InteractiveCheck] Result: TRUE (onclick attribute)');
      return { interactive: true, reason: 'onclick attribute found in hierarchy' };
    }
    // チェック4: contentEditable
    if (isEditable) {
      console.log('[InteractiveCheck] Result: TRUE (contentEditable)');
      return { interactive: true, reason: 'contentEditable element found in hierarchy' };
    }
    // チェック5: Cursorスタイル
    if (cursorStyle === 'pointer') {
      console.log('[InteractiveCheck] Result: TRUE (Cursor Style: pointer)');
      return { interactive: true, reason: 'Cursor Style (pointer) found in hierarchy' };
    }
    // チェック6: cursor-pointer クラス (getComputedStyleが効かない場合のフォールバック)
    if (classList && classList.contains('cursor-pointer')) {
        console.log('[InteractiveCheck] Result: TRUE (Class: cursor-pointer)');
        return { interactive: true, reason: 'cursor-pointer class found in hierarchy' };
    }

    // SVGやPATHのような要素はそれ自体はインタラクティブでないことが多いので、親をチェックし続ける
    if (['SVG', 'PATH', 'G'].includes(tagName)){
       console.log('[InteractiveCheck] Element is SVG/PATH/G, continuing to parent.');
       // Keep checking parents
    } else if (!['DIV', 'SPAN', 'I', 'IMG'].includes(tagName)) {
        console.log(`[InteractiveCheck] Element <${tagName}> is not a common container, stopping ancestor check.`);
        // 特定のコンテナ要素以外なら、これ以上親を遡らない方が安全な場合も
        // break; // 必要に応じてこのコメントを解除
    }

    current = current.parentElement;
    if (!current) {
        console.log('[InteractiveCheck] Reached end of parents.');
    }
  }
  console.log('[InteractiveCheck] Result: FALSE (No interactive criteria met in hierarchy)');
  return { interactive: false, reason: 'No interactive criteria met in hierarchy' };
}

// クリックイベントのリスナー
document.addEventListener('click', async (event) => {
  const target = event.target;
  const { interactive, reason } = isElementOrAncestorInteractive(target);

  if (interactive) {
    console.log(`Click event detected on interactive element or ancestor (Reason: ${reason}):`, target);

    // クリックされた要素またはその祖先に <a> タグがあるか確認
    const isLinkClick = target.closest('a') !== null;
    console.log(`Is link click: ${isLinkClick}`);

    // isLinkClick が true の場合のみ captureImmediate: true を渡す
    await requestScreenshot({ captureImmediate: isLinkClick });

  } else {
    // console.log('Click event detected on non-interactive element/ancestor, ignoring:', target);
  }
}, true); // Use capture phase

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
      // Enter キーの場合は即時キャプチャは不要とする (オプションは渡さない)
      await requestScreenshot();
    } else {
      // console.log('Enter key detected, but not on a common interactive element, ignoring:', target);
    }
  }
}); 