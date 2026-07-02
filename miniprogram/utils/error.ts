/**
 * 统一错误处理
 * 显示用户可见的 toast 提示，同时输出日志
 */

/**
 * 显示错误提示
 * @param msg 用户可见的错误消息
 * @param err 原始错误对象（可选，用于控制台输出）
 */
function showError(msg: string, err?: any): void {
  console.error(`[Error] ${msg}`, err || '');
  wx.showToast({
    title: msg,
    icon: 'none',
    duration: 2000,
  });
}

/**
 * 显示成功提示
 */
function showSuccess(msg: string): void {
  wx.showToast({
    title: msg,
    icon: 'success',
    duration: 1500,
  });
}

/**
 * 显示加载提示
 */
function showLoading(msg: string = '加载中...'): void {
  wx.showLoading({
    title: msg,
    mask: true,
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading(): void {
  wx.hideLoading();
}

export { showError, showSuccess, showLoading, hideLoading };
