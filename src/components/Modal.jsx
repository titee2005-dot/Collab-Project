import {useLayoutEffect, useRef} from 'react';
import {X} from 'lucide-react';

export default function Modal({title, onClose, children, wide = false}) {
  const dialog = useRef(null);
  const trigger = useRef(document.activeElement);

  useLayoutEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      const previous = trigger.current;
      queueMicrotask(() => {
        if (previous?.isConnected && !document.querySelector('dialog[open]')) {
          previous.focus({preventScroll: true});
        }
      });
    };
  }, []);

  return <dialog ref={dialog} className={`modal ${wide ? 'wide' : ''}`} aria-label={title}
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="modal-header">
      <span className="eyebrow">HEART COLLECTION</span>
      <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button>
    </div>
    <h2>{title}</h2>
    {children}
  </dialog>;
}
