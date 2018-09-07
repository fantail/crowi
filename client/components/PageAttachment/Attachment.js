import React from 'react'
import PropTypes from 'prop-types'

import Icon from 'components/Common/Icon'
import User from 'components/User/User'

export default class Attachment extends React.Component {
  constructor(props) {
    super(props)

    this._onAttachmentDeleteClicked = this._onAttachmentDeleteClicked.bind(this)
  }

  iconNameByFormat(format) {
    if (format.match(/image\/.+/i)) {
      return 'file-image'
    }

    return 'file'
  }

  _onAttachmentDeleteClicked(event) {
    this.props.onAttachmentDeleteClicked(this.props.attachment)
  }

  render() {
    const attachment = this.props.attachment
    const formatIcon = this.iconNameByFormat(attachment.fileFormat)

    let fileInUse = ''
    if (this.props.inUse) {
      fileInUse = <span className="attachment-in-use badge badge-info">In Use</span>
    }

    const fileType = <span className="attachment-filetype badge badge-secondary">{attachment.fileFormat}</span>

    return (
      <li>
        <User user={attachment.creator} />
        <Icon name={formatIcon} regular />

        <a href={attachment.url}> {attachment.originalName}</a>

        {fileType}

        {fileInUse}

        <a className="text-danger attachment-delete" onClick={this._onAttachmentDeleteClicked}>
          <Icon name="trash" solid />
        </a>
      </li>
    )
  }
}

Attachment.propTypes = {
  attachment: PropTypes.object.isRequired,
  inUse: PropTypes.bool.isRequired,
  onAttachmentDeleteClicked: PropTypes.func.isRequired,
}

Attachment.defaultProps = {}
